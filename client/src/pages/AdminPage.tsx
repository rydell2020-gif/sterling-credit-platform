import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type {
  User, CreditReport, Dispute, Document as DocRecord, Expense, CalendarEvent, AuditLog, Invite,
} from "@shared/schema";
import {
  Shield, Users, FileText, MessageSquare, Eye, Pencil, Trash2, UserPlus, DollarSign, CalendarDays,
  Mail, Copy, Send, XCircle, Crown,
} from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  upload: "text-blue-400 border-blue-400/30",
  analyze: "text-primary border-primary/30",
  dispute_generated: "text-green-400 border-green-400/30",
  report_downloaded: "text-purple-400 border-purple-400/30",
  expense_created: "text-amber-400 border-amber-400/30",
  document_uploaded: "text-cyan-400 border-cyan-400/30",
};

const COLOR_DOT: Record<string, string> = {
  red: "bg-red-500", gold: "bg-primary", green: "bg-green-500", blue: "bg-blue-500",
};

interface AdminStats { users: number; reports: number; disputes: number; analyses: number; }

interface AdminUser extends User {}

interface UserDetail {
  user: User;
  reports: CreditReport[];
  tradelines: unknown[];
  disputes: Dispute[];
  analyses: unknown[];
  documents: DocRecord[];
  expenses: Expense[];
  calendarEvents: CalendarEvent[];
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", password: "" });
  const [editForm, setEditForm] = useState({ fullName: "", email: "", role: "user" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", role: "user", message: "" });
  const [justCreatedInvite, setJustCreatedInvite] = useState<Invite | null>(null);

  const isPrivileged = user?.role === "admin" || user?.role === "owner";
  const isOwner = user?.role === "owner";

  if (user && !isPrivileged) {
    navigate("/dashboard");
    return null;
  }

  const enabled = !!user && isPrivileged;

  const { data: stats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"], enabled });
  const { data: users = [] } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"], enabled });
  const { data: logs = [] } = useQuery<AuditLog[]>({ queryKey: ["/api/admin/audit-logs"], enabled });
  const { data: businessExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/admin/expenses", "business"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/expenses?scope=business");
      return res.json();
    },
    enabled,
  });
  const { data: allEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/admin/calendar"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/calendar");
      return res.json();
    },
    enabled,
  });

  // per-user detail for view drawer
  const { data: detail } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", viewUserId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${viewUserId}`);
      return res.json();
    },
    enabled: !!viewUserId,
  });

  // Resource counts per user
  const { data: allReports } = useQuery<Record<string, number>>({
    queryKey: ["/api/admin/users", "resource-counts", users.map((u) => u.id).join(",")],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(users.map(async (u) => {
        const res = await apiRequest("GET", `/api/admin/users/${u.id}`);
        const d: UserDetail = await res.json();
        counts[u.id] = (d.reports?.length || 0) * 1000 + (d.disputes?.length || 0);
      }));
      return counts;
    },
    enabled: enabled && users.length > 0,
  });

  const unreadTotal = 0; // messages unread across clients — placeholder; computed via detail if needed
  const activeDisputes = useMemo(() => stats?.disputes ?? 0, [stats]);

  const saveEditMut = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      await apiRequest("PATCH", `/api/admin/users/${editUser.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditUser(null);
      toast({ title: "Saved", description: "User updated." });
    },
    onError: () => toast({ title: "Error", description: "Could not update user.", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/admin/users/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteUserTarget(null);
      toast({ title: "Deleted", description: "User and owned resources removed." });
    },
  });

  const createUserMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/signup", newUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNewUserOpen(false);
      setNewUser({ fullName: "", email: "", password: "" });
      toast({ title: "Created", description: "New user added." });
    },
    onError: () => toast({ title: "Error", description: "Could not create user (email may exist).", variant: "destructive" }),
  });

  const { data: invites = [] } = useQuery<Invite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/invites");
      return res.json();
    },
    enabled,
  });

  const createInviteMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invites", inviteForm);
      return res.json() as Promise<Invite>;
    },
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setJustCreatedInvite(invite);
      setInviteForm({ email: "", fullName: "", role: "user", message: "" });
      toast({ title: "Invite created", description: "Copy the link below and send it to your invitee." });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not create invite";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const revokeInviteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/admin/invites/${id}/revoke`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Revoked", description: "Invite is no longer valid." });
    },
  });

  const inviteLink = (token: string) => `${window.location.origin}/#/invite/${token}`;
  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      toast({ title: "Copied", description: "Invite link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the link and copy it manually.", variant: "destructive" });
    }
  };

  const eventsByUser = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    allEvents.forEach((e) => {
      if (!map[e.userId]) map[e.userId] = [];
      map[e.userId].push(e);
    });
    return map;
  }, [allEvents]);

  const userName = (id: string) => users.find((u) => u.id === id)?.fullName || id;

  return (
    <AppLayout>
      <div data-testid="page-admin">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-serif">Admin Console</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5" data-testid="count-users"><Users className="h-4 w-4" /> {users.length} users</span>
            <span className="flex items-center gap-1.5" data-testid="count-disputes"><FileText className="h-4 w-4" /> {activeDisputes} active disputes</span>
            <span className="flex items-center gap-1.5" data-testid="count-unread"><MessageSquare className="h-4 w-4" /> {unreadTotal} unread messages</span>
          </div>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="invites" data-testid="tab-invites">Invitations</TabsTrigger>
            <TabsTrigger value="expenses" data-testid="tab-expenses">Business Expenses</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">All Calendar</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <div className="flex justify-end mb-4 gap-2">
              <Button size="sm" variant="outline" data-testid="button-invite-user" onClick={() => { setJustCreatedInvite(null); setInviteOpen(true); }}>
                <Mail className="h-4 w-4 mr-1" /> Invite by Email
              </Button>
              <Button size="sm" data-testid="button-new-user" onClick={() => setNewUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> New User
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reports</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Disputes</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const packed = allReports?.[u.id] ?? 0;
                        const reportCount = Math.floor(packed / 1000);
                        const disputeCount = packed % 1000;
                        return (
                          <tr key={u.id} className="border-b border-border hover:bg-muted/20 transition-colors" data-testid={`row-user-${u.id}`}>
                            <td className="px-4 py-3 font-medium">{u.fullName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`text-xs ${
                                u.role === "owner" ? "text-primary border-primary/60 bg-primary/10" :
                                u.role === "admin" ? "text-primary border-primary/30" :
                                "text-muted-foreground"
                              }`}>
                                {u.role === "owner" && <Crown className="h-3 w-3 inline mr-1 -mt-0.5" />}
                                {u.role}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">{allReports ? reportCount : "…"}</td>
                            <td className="px-4 py-3 text-center">{allReports ? disputeCount : "…"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button data-testid={`button-view-user-${u.id}`} onClick={() => setViewUserId(u.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="View"><Eye className="h-4 w-4" /></button>
                                <button data-testid={`button-edit-user-${u.id}`} onClick={() => { setEditUser(u); setEditForm({ fullName: u.fullName, email: u.email, role: u.role }); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Edit"><Pencil className="h-4 w-4" /></button>
                                <button data-testid={`button-delete-user-${u.id}`} onClick={() => setDeleteUserTarget(u)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVITATIONS */}
          <TabsContent value="invites">
            <div className="flex justify-end mb-4">
              <Button size="sm" data-testid="button-open-invite" onClick={() => { setJustCreatedInvite(null); setInviteOpen(true); }}>
                <Mail className="h-4 w-4 mr-1" /> New Invitation
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Expires</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No invitations yet. Click “New Invitation” to enroll a client or admin.</td></tr>
                      ) : invites.map((inv) => {
                        const statusColor =
                          inv.status === "pending" ? "text-amber-400 border-amber-500/30" :
                          inv.status === "accepted" ? "text-green-400 border-green-500/30" :
                          inv.status === "revoked" ? "text-muted-foreground" :
                          "text-red-400 border-red-500/30";
                        return (
                          <tr key={inv.id} className="border-b border-border hover:bg-muted/20" data-testid={`row-invite-${inv.id}`}>
                            <td className="px-4 py-3 font-medium">{inv.email}</td>
                            <td className="px-4 py-3 text-muted-foreground">{inv.fullName || "—"}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{inv.role}</Badge></td>
                            <td className="px-4 py-3"><Badge variant="outline" className={`text-xs capitalize ${statusColor}`}>{inv.status}</Badge></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {inv.status === "pending" && (
                                  <>
                                    <button data-testid={`button-copy-invite-${inv.id}`} onClick={() => copyInviteLink(inv.token)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Copy link"><Copy className="h-4 w-4" /></button>
                                    <button data-testid={`button-revoke-invite-${inv.id}`} onClick={() => revokeInviteMut.mutate(inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Revoke"><XCircle className="h-4 w-4" /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS EXPENSES */}
          <TabsContent value="expenses">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Card><CardContent className="p-5"><DollarSign className="h-5 w-5 text-primary mb-3" /><div className="font-serif text-3xl">{fmtMoney(businessExpenses.reduce((s, e) => s + e.amount, 0))}</div><p className="text-xs text-muted-foreground mt-1">Total Business Spend</p></CardContent></Card>
              <Card><CardContent className="p-5"><FileText className="h-5 w-5 text-blue-400 mb-3" /><div className="font-serif text-3xl">{businessExpenses.length}</div><p className="text-xs text-muted-foreground mt-1">Line Items</p></CardContent></Card>
              <Card><CardContent className="p-5"><DollarSign className="h-5 w-5 text-purple-400 mb-3" /><div className="font-serif text-3xl">{new Set(businessExpenses.map((e) => e.category)).size}</div><p className="text-xs text-muted-foreground mt-1">Categories</p></CardContent></Card>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessExpenses.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No business expenses recorded.</td></tr>
                      ) : businessExpenses.map((e) => (
                        <tr key={e.id} className="border-b border-border hover:bg-muted/20 transition-colors" data-testid={`row-business-expense-${e.id}`}>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(e.occurredOn).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">{e.vendor || "—"}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{e.category.replace("_", " ")}</Badge></td>
                          <td className="px-4 py-3 text-right font-medium">{fmtMoney(e.amount)}</td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{e.paymentMethod || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL CALENDAR */}
          <TabsContent value="calendar">
            <div className="space-y-4">
              {Object.keys(eventsByUser).length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No calendar events across users.</CardContent></Card>
              ) : Object.entries(eventsByUser).map(([uid, evts]) => (
                <Card key={uid} data-testid={`calendar-group-${uid}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> {userName(uid)}
                      <Badge variant="outline" className="text-xs ml-1">{evts.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {evts.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20" data-testid={`admin-event-${e.id}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[e.colorTag || "blue"] || "bg-blue-500"}`} />
                        <span className="text-sm font-medium flex-1 truncate">{e.title}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.eventDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* AUDIT LOG */}
          <TabsContent value="audit">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors" data-testid={`row-audit-${log.id}`}>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                          <td className="px-4 py-3 text-xs">{log.userId}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || "text-muted-foreground"}`}>{log.action}</Badge></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{log.resource || "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{log.metadata ? JSON.stringify(log.metadata) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View drawer */}
        <Sheet open={!!viewUserId} onOpenChange={(o) => !o && setViewUserId(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="drawer-user-detail">
            <SheetHeader>
              <SheetTitle className="font-serif">{detail?.user.fullName || "User Detail"}</SheetTitle>
            </SheetHeader>
            {detail && (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{detail.user.email}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="outline" className="text-xs">{detail.user.role}</Badge>
                    {detail.user.croaDisclosureAcknowledged && <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">CROA</Badge>}
                    {detail.user.csoConsent && <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">CSO</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Reports", val: detail.reports.length },
                    { label: "Disputes", val: detail.disputes.length },
                    { label: "Documents", val: detail.documents.length },
                    { label: "Expenses", val: detail.expenses.length },
                    { label: "Events", val: detail.calendarEvents.length },
                    { label: "Analyses", val: detail.analyses.length },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="font-serif text-2xl">{s.val}</div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
                {detail.documents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Documents</p>
                    <div className="space-y-1.5">
                      {detail.documents.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-muted/20 text-xs">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          <span className="flex-1 truncate">{d.fileName}</span>
                          <Badge variant="outline" className="text-[10px]">{d.docType}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit dialog */}
        <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
          <DialogContent data-testid="dialog-edit-user">
            <DialogHeader><DialogTitle className="font-serif">Edit User</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input data-testid="input-edit-name" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input data-testid="input-edit-email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)} data-testid="button-cancel-edit">Cancel</Button>
              <Button onClick={() => saveEditMut.mutate()} disabled={saveEditMut.isPending} data-testid="button-save-user">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!deleteUserTarget} onOpenChange={(o) => !o && setDeleteUserTarget(null)}>
          <DialogContent data-testid="dialog-delete-user">
            <DialogHeader>
              <DialogTitle className="font-serif">Delete User</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{deleteUserTarget?.fullName}</strong> and all owned resources (reports, disputes, documents, expenses, events, messages). This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserTarget(null)} data-testid="button-cancel-delete">Cancel</Button>
              <Button variant="destructive" onClick={() => deleteUserTarget && deleteMut.mutate(deleteUserTarget.id)} disabled={deleteMut.isPending} data-testid="button-confirm-delete">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New user dialog */}
        <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
          <DialogContent data-testid="dialog-new-user">
            <DialogHeader><DialogTitle className="font-serif">New User</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input data-testid="input-new-name" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input data-testid="input-new-email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password</Label>
                <Input data-testid="input-new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewUserOpen(false)} data-testid="button-cancel-new-user">Cancel</Button>
              <Button
                onClick={() => createUserMut.mutate()}
                disabled={!newUser.fullName || !newUser.email || !newUser.password || createUserMut.isPending}
                data-testid="button-create-user"
              >Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invite dialog */}
        <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setJustCreatedInvite(null); }}>
          <DialogContent data-testid="dialog-invite-user">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Invite {justCreatedInvite ? "Sent" : "a Client or Admin"}
              </DialogTitle>
              <DialogDescription>
                {justCreatedInvite
                  ? "Share this secure link with your invitee. They’ll set their own password and get access with the role you selected."
                  : "Create a one-time enrollment link. Send it via email or SMS — they'll set their own password on acceptance."}
              </DialogDescription>
            </DialogHeader>

            {justCreatedInvite ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Invitee</p>
                  <p className="text-sm">{justCreatedInvite.fullName || "—"} · <span className="text-muted-foreground">{justCreatedInvite.email}</span></p>
                  <div className="flex gap-2 pt-1">
                    <Badge variant="outline" className="text-xs capitalize">{justCreatedInvite.role}</Badge>
                    <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">Pending</Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invite link (expires in 14 days)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink(justCreatedInvite.token)} className="font-mono text-xs" data-testid="input-invite-link" onFocus={(e) => e.currentTarget.select()} />
                    <Button size="sm" variant="outline" onClick={() => copyInviteLink(justCreatedInvite.token)} data-testid="button-copy-invite">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <a
                  href={`mailto:${encodeURIComponent(justCreatedInvite.email)}?subject=${encodeURIComponent("You're invited to Sterling Credit Solutions")}&body=${encodeURIComponent(
                    `Hi ${justCreatedInvite.fullName || ""},\n\nYou've been invited to join Sterling Credit Solutions. Follow this link to activate your account:\n\n${inviteLink(justCreatedInvite.token)}\n\n${justCreatedInvite.message || ""}\n\n— Rydell, Sterling Credit Solutions`
                  )}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Send className="h-4 w-4" /> Open in your email client
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input data-testid="input-invite-email" type="email" placeholder="client@example.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Name (optional)</Label>
                  <Input data-testid="input-invite-name" placeholder="Full name" value={inviteForm.fullName} onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                    <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Client (user)</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Clients see the client dashboard. Admins get the Admin Console. Owner has full control (only owners can invite other owners).</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Personal message (optional)</Label>
                  <Textarea data-testid="input-invite-message" placeholder="A short welcome note included in the email template." value={inviteForm.message} onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })} rows={3} />
                </div>
              </div>
            )}

            <DialogFooter>
              {justCreatedInvite ? (
                <>
                  <Button variant="outline" onClick={() => setJustCreatedInvite(null)} data-testid="button-invite-another">Invite Another</Button>
                  <Button onClick={() => { setInviteOpen(false); setJustCreatedInvite(null); }} data-testid="button-invite-done">Done</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setInviteOpen(false)} data-testid="button-cancel-invite">Cancel</Button>
                  <Button
                    onClick={() => createInviteMut.mutate()}
                    disabled={!inviteForm.email || createInviteMut.isPending}
                    data-testid="button-send-invite"
                  >
                    <Send className="h-4 w-4 mr-1" /> {createInviteMut.isPending ? "Creating…" : "Create Invite"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
