import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  FileText,
  BarChart3,
  Shield,
  AlertTriangle,
} from "lucide-react";

interface AdminStats {
  users: number;
  reports: number;
  disputes: number;
  analyses: number;
}

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  croaDisclosureAcknowledged: boolean | null;
  csoConsent: boolean | null;
  createdAt: string | null;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  upload: "text-blue-400 border-blue-400/30",
  analyze: "text-primary border-primary/30",
  dispute_generated: "text-green-400 border-green-400/30",
  report_downloaded: "text-purple-400 border-purple-400/30",
};

export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirect non-admin users
  if (user && user.role !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && user.role === "admin",
  });

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.role === "admin",
  });

  const { data: logs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: !!user && user.role === "admin",
  });

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-serif">Admin Panel</h1>
        </div>
        <p className="text-muted-foreground">Platform management and monitoring.</p>
      </div>

      <Tabs defaultValue="stats">
        <TabsList className="mb-6">
          <TabsTrigger value="stats">Platform Stats</TabsTrigger>
          <TabsTrigger value="users">Users ({users?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log ({logs?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Platform Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <Users className="h-5 w-5 text-primary mb-3" />
                <div className="font-serif text-3xl">{stats?.users ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <FileText className="h-5 w-5 text-blue-400 mb-3" />
                <div className="font-serif text-3xl">{stats?.reports ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Reports Uploaded</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <AlertTriangle className="h-5 w-5 text-green-400 mb-3" />
                <div className="font-serif text-3xl">{stats?.disputes ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Disputes Generated</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <BarChart3 className="h-5 w-5 text-purple-400 mb-3" />
                <div className="font-serif text-3xl">{stats?.analyses ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Analyses Run</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">CROA</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">CSO</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{u.fullName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              u.role === "admin" ? "text-primary border-primary/30" : "text-muted-foreground"
                            }`}
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {u.croaDisclosureAcknowledged ? (
                            <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">No</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.csoConsent ? (
                            <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">No</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log */}
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
                    {logs?.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">{log.userId}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ACTION_COLORS[log.action] || "text-muted-foreground"}`}
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{log.resource || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {log.metadata ? JSON.stringify(log.metadata) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
