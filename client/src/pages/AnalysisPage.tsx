import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Percent,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Loader2,
  HelpCircle,
} from "lucide-react";

interface Recommendation {
  priority: string;
  category: string;
  title: string;
  description: string;
  impact: string;
}

interface Tradeline {
  id: string;
  creditorName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  currentBalance: number;
  creditLimit: number;
  utilizationPct: number;
  paymentStatus: string;
  accountAgeMonths: number;
  riskScore: number;
  isDerogatory: boolean;
  isDisputable: boolean;
  disputeReason: string | null;
  bureau: string;
}

interface Analysis {
  id: string;
  recommendations: Recommendation[];
  priorityActions: string[];
  riskAssessment: {
    overallRisk: string;
    derogatoryCount: number;
    utilizationAvg: number;
    oldestAccount: string;
  };
}

const GLOSSARY = [
  { term: "Tradeline", def: "An account listed on your credit report — credit cards, loans, collections, etc." },
  { term: "Utilization", def: "The percentage of your available credit that you're using. Lower is generally better (under 30%)." },
  { term: "Derogatory", def: "A negative item such as a collection, charge-off, or late payment that damages your score." },
  { term: "FCRA", def: "Fair Credit Reporting Act — federal law that gives you the right to dispute inaccurate information." },
  { term: "Risk Score", def: "Our internal 0-100 score estimating how much an account impacts your credit negatively. Higher = more risk." },
];

function getRiskColor(score: number) {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-primary";
  return "text-green-500";
}

function getRiskBg(score: number) {
  if (score >= 70) return "bg-destructive";
  if (score >= 40) return "bg-primary";
  return "bg-green-500";
}

export default function AnalysisPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "derogatory" | "disputable">("all");

  const { data: analysis } = useQuery<Analysis>({
    queryKey: ["/api/analysis", user?.id],
    enabled: !!user,
  });

  const { data: tradelines } = useQuery<Tradeline[]>({
    queryKey: ["/api/tradelines", user?.id],
    enabled: !!user,
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/analysis/${user?.id}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analysis", user?.id] });
    },
  });

  const filteredTradelines = tradelines?.filter((tl) => {
    if (filter === "derogatory") return tl.isDerogatory;
    if (filter === "disputable") return tl.isDisputable;
    return true;
  });

  const totalTradelines = tradelines?.length ?? 0;
  const derogCount = tradelines?.filter((t) => t.isDerogatory).length ?? 0;
  const avgUtil = tradelines?.length
    ? (tradelines.reduce((sum, t) => sum + (t.utilizationPct || 0), 0) / tradelines.length).toFixed(1)
    : "0";

  const avgScore = tradelines?.length
    ? Math.round(tradelines.reduce((sum, t) => sum + (t.riskScore || 0), 0) / tradelines.length)
    : 0;

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-2">Credit Analysis</h1>
            <p className="text-muted-foreground">AI-powered analysis of your credit profile.</p>
          </div>
          <Button onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending}>
            {runAnalysis.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Run Analysis
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <BarChart3 className="h-5 w-5 text-primary mb-3" />
            <div className="font-serif text-3xl">{avgScore}</div>
            <p className="text-xs text-muted-foreground mt-1">Avg Risk Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <TrendingUp className="h-5 w-5 text-blue-400 mb-3" />
            <div className="font-serif text-3xl">{totalTradelines}</div>
            <p className="text-xs text-muted-foreground mt-1">Total Tradelines</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <AlertTriangle className="h-5 w-5 text-destructive mb-3" />
            <div className="font-serif text-3xl">{derogCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Derogatory Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Percent className="h-5 w-5 text-primary mb-3" />
            <div className="font-serif text-3xl">{avgUtil}%</div>
            <p className="text-xs text-muted-foreground mt-1">Avg Utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      {analysis?.recommendations && (analysis.recommendations as Recommendation[]).length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(analysis.recommendations as Recommendation[]).map((rec, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border-l-4 ${
                  rec.priority === "high"
                    ? "border-l-destructive bg-destructive/5"
                    : rec.priority === "medium"
                    ? "border-l-primary bg-primary/5"
                    : "border-l-green-500 bg-green-500/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      rec.priority === "high"
                        ? "text-destructive border-destructive/30"
                        : rec.priority === "medium"
                        ? "text-primary border-primary/30"
                        : "text-green-500 border-green-500/30"
                    }`}
                  >
                    {rec.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {rec.category}
                  </Badge>
                </div>
                <p className="font-medium text-sm">{rec.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                {rec.impact && <p className="text-xs text-green-400 mt-2">↗ {rec.impact}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: "all", label: `All (${totalTradelines})` },
          { key: "derogatory", label: `Derogatory (${derogCount})` },
          { key: "disputable", label: `Disputable (${tradelines?.filter((t) => t.isDisputable).length ?? 0})` },
        ] as const).map((tab) => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.key)}
            className="rounded-full text-xs"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tradeline table */}
      <Card className="mb-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Utilization</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Age</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTradelines?.map((tl) => (
                  <TradelineRow key={tl.id} tl={tl} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Glossary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Credit Glossary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GLOSSARY.map((item) => (
              <div key={item.term} className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-medium text-primary">{item.term}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.def}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function TradelineRow({ tl }: { tl: Tradeline }) {
  const [open, setOpen] = useState(false);
  const years = Math.floor((tl.accountAgeMonths || 0) / 12);
  const months = (tl.accountAgeMonths || 0) % 12;

  return (
    <>
      <tr
        className={`border-b border-border cursor-pointer hover:bg-muted/20 transition-colors ${
          tl.isDerogatory ? "bg-destructive/5" : ""
        }`}
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <div>
              <p className="font-medium">{tl.creditorName}</p>
              <p className="text-xs text-muted-foreground">{tl.accountNumber} · {tl.accountType}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge
            variant="outline"
            className={`text-xs ${
              tl.isDerogatory
                ? "text-destructive border-destructive/30"
                : tl.accountStatus === "open"
                ? "text-green-500 border-green-500/30"
                : "text-muted-foreground"
            }`}
          >
            {tl.accountStatus}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right font-medium">
          ${(tl.currentBalance || 0).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Progress value={Math.min(tl.utilizationPct || 0, 100)} className="h-1.5 w-16" />
            <span className="text-xs text-muted-foreground">{(tl.utilizationPct || 0).toFixed(0)}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {years > 0 ? `${years}y ` : ""}{months}m
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getRiskBg(tl.riskScore)}`} />
            <span className={`text-xs font-medium ${getRiskColor(tl.riskScore)}`}>{tl.riskScore}/100</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {tl.isDisputable && (
            <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
              Disputable
            </Badge>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/10">
          <td colSpan={7} className="px-4 py-4">
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Payment Status:</span>
                  <p className="font-medium capitalize">{tl.paymentStatus}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Credit Limit:</span>
                  <p className="font-medium">{tl.creditLimit ? `$${tl.creditLimit.toLocaleString()}` : "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bureau:</span>
                  <p className="font-medium capitalize">{tl.bureau}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Derogatory:</span>
                  <p className={`font-medium ${tl.isDerogatory ? "text-destructive" : "text-green-500"}`}>
                    {tl.isDerogatory ? "Yes" : "No"}
                  </p>
                </div>
              </div>
              {tl.disputeReason && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-xs text-blue-400 font-medium mb-1">Dispute Grounds</p>
                  <p className="text-xs text-muted-foreground">{tl.disputeReason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
