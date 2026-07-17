import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Expense } from "@shared/schema";
import {
  DollarSign, TrendingUp, TrendingDown, Layers, Trash2, Plus, Receipt, Wallet, Briefcase,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const CATEGORIES = [
  "rent", "utilities", "credit_card", "food", "transport", "insurance",
  "subscription", "ads", "software", "mileage", "client_fee", "other",
];
const PAYMENT_METHODS = ["cash", "debit", "credit", "ach", "check"];

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Rent", utilities: "Utilities", credit_card: "Credit Card", food: "Food",
  transport: "Transport", insurance: "Insurance", subscription: "Subscription",
  ads: "Ads", software: "Software", mileage: "Mileage", client_fee: "Client Fee", other: "Other",
};

const CHART_COLOR = "hsl(43 78% 45%)";

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function monthKey(dateStr: string) {
  return (dateStr || "").slice(0, 7); // YYYY-MM
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scope, setScope] = useState<"personal" | "business">("personal");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add form state
  const [form, setForm] = useState({
    category: "other",
    vendor: "",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    paymentMethod: "credit",
    notes: "",
  });

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", scope, user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/expenses?scope=${scope}`);
      return res.json();
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/expenses", {
        userId: user?.id,
        scope,
        category: form.category,
        vendor: form.vendor || null,
        amount: parseFloat(form.amount),
        currency: "USD",
        occurredOn: form.occurredOn,
        paymentMethod: form.paymentMethod,
        notes: form.notes || null,
        isRecurring: false,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", scope, user?.id] });
      setForm({ ...form, vendor: "", amount: "", notes: "" });
      toast({ title: "Expense added", description: "Your expense has been recorded." });
    },
    onError: () => toast({ title: "Error", description: "Could not add expense.", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", scope, user?.id] });
      toast({ title: "Deleted", description: "Expense removed." });
    },
  });

  // Available months for filter
  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKey(e.occurredOn)));
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (monthFilter !== "all" && monthKey(e.occurredOn) !== monthFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      return true;
    });
  }, [expenses, monthFilter, categoryFilter]);

  // Stats — current month vs last month based on latest data month
  const stats = useMemo(() => {
    const byMonth: Record<string, number> = {};
    expenses.forEach((e) => {
      const k = monthKey(e.occurredOn);
      byMonth[k] = (byMonth[k] || 0) + e.amount;
    });
    const sortedMonths = Object.keys(byMonth).sort().reverse();
    const thisMonth = sortedMonths[0] ? byMonth[sortedMonths[0]] : 0;
    const lastMonth = sortedMonths[1] ? byMonth[sortedMonths[1]] : 0;
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    const categoriesUsed = new Set(expenses.map((e) => e.category)).size;
    return { thisMonth, lastMonth, change, categoriesUsed };
  }, [expenses]);

  // Category breakdown for chart (respect filters)
  const chartData = useMemo(() => {
    const byCat: Record<string, number> = {};
    filtered.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });
    return Object.entries(byCat)
      .map(([category, total]) => ({ category: CATEGORY_LABELS[category] || category, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const statCards = [
    { label: "Total This Month", value: fmtMoney(stats.thisMonth), icon: DollarSign, color: "text-primary" },
    { label: "Total Last Month", value: fmtMoney(stats.lastMonth), icon: Wallet, color: "text-blue-400" },
    {
      label: "Change %",
      value: `${stats.change >= 0 ? "+" : ""}${stats.change.toFixed(1)}%`,
      icon: stats.change >= 0 ? TrendingUp : TrendingDown,
      color: stats.change >= 0 ? "text-destructive" : "text-green-400",
    },
    { label: "Categories Used", value: String(stats.categoriesUsed), icon: Layers, color: "text-purple-400" },
  ];

  return (
    <AppLayout>
      <div data-testid="page-expenses">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif">Expense Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Track {scope === "personal" ? "your personal" : "business"} expenses month over month.
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border">
            <button
              data-testid="toggle-scope-personal"
              onClick={() => setScope("personal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                scope === "personal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="h-4 w-4" /> Personal
            </button>
            <button
              data-testid="toggle-scope-business"
              onClick={() => setScope("business")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                scope === "business" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-4 w-4" /> Business
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <Card key={s.label} data-testid={`stat-${s.label}`}>
              <CardContent className="p-5">
                <s.icon className={`h-5 w-5 ${s.color} mb-3`} />
                <div className="font-serif text-3xl">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-40" data-testid="filter-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44" data-testid="filter-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two column: table + add form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {scope === "personal" ? "Personal" : "Business"} Expenses ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 flex flex-col items-center text-center gap-3" data-testid="empty-expenses">
                    <Receipt className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
                    <p className="text-xs text-muted-foreground/60">Add your first expense using the form.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((e) => (
                          <tr key={e.id} className="border-b border-border hover:bg-muted/20 transition-colors" data-testid={`row-expense-${e.id}`}>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(e.occurredOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 font-medium">{e.vendor || "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[e.category] || e.category}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{fmtMoney(e.amount)}</td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">{e.paymentMethod || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                data-testid={`button-delete-expense-${e.id}`}
                                onClick={() => deleteMut.mutate(e.id)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Add form */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Add Expense
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-amount" className="text-xs">Amount</Label>
                  <Input
                    id="exp-amount"
                    data-testid="input-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-vendor" className="text-xs">Vendor</Label>
                  <Input
                    id="exp-vendor"
                    data-testid="input-vendor"
                    placeholder="e.g. H-E-B"
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-date" className="text-xs">Date</Label>
                  <Input
                    id="exp-date"
                    data-testid="input-date"
                    type="date"
                    value={form.occurredOn}
                    onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-notes" className="text-xs">Notes</Label>
                  <Textarea
                    id="exp-notes"
                    data-testid="input-notes"
                    placeholder="Optional"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <Button
                  data-testid="button-add-expense"
                  className="w-full"
                  disabled={!form.amount || parseFloat(form.amount) <= 0 || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? "Adding…" : "Add Expense"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category breakdown chart */}
        {chartData.length > 0 && (
          <Card data-testid="chart-category-breakdown">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <XAxis dataKey="category" stroke="hsl(0 0% 60%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(0 0% 60%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: "hsl(0 0% 100% / 0.04)" }}
                    contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtMoney(v), "Total"]}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={CHART_COLOR} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
