import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  GitCompare,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  Upload,
} from "lucide-react";

interface BureauComparison {
  id: string;
  discrepancyType: string;
  creditorName: string;
  accountNumber: string | null;
  bureausAffected: string[];
  details: Record<string, unknown>;
  severity: string;
  isDisputable: boolean;
}

interface CreditReport {
  id: string;
  bureau: string;
  fileName: string;
  status: string;
}

const TYPE_LABELS: Record<string, string> = {
  balance_mismatch: "Balance Mismatch",
  status_mismatch: "Status Mismatch",
  date_mismatch: "Date Mismatch",
  missing_account: "Missing Account",
  limit_mismatch: "Credit Limit Mismatch",
  payment_history_mismatch: "Payment History Mismatch",
};

const SEV_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  high: { border: "border-destructive/50", bg: "bg-destructive/5", text: "text-destructive" },
  medium: { border: "border-primary/50", bg: "bg-primary/5", text: "text-primary" },
  low: { border: "border-green-500/50", bg: "bg-green-500/5", text: "text-green-500" },
};

export default function ComparisonPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "high" | "disputable">("all");

  const { data: comparisons, isLoading } = useQuery<BureauComparison[]>({
    queryKey: ["/api/comparisons", user?.id],
    enabled: !!user,
  });

  const { data: reports } = useQuery<CreditReport[]>({
    queryKey: ["/api/reports", user?.id],
    enabled: !!user,
  });

  const bureausPresent = Array.from(new Set((reports || []).map((r) => r.bureau)));

  const filtered = (comparisons || []).filter((d) => {
    if (filter === "high") return d.severity === "high";
    if (filter === "disputable") return d.isDisputable;
    return true;
  });

  const highCount = (comparisons || []).filter((d) => d.severity === "high").length;
  const disputableCount = (comparisons || []).filter((d) => d.isDisputable).length;

  return (
    <AppLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif mb-2">Cross-Bureau Comparison</h1>
          <p className="text-muted-foreground">
            Finds discrepancies in how the same accounts are reported across bureaus.
          </p>
        </div>
      </div>

      {/* Warning if < 2 bureaus */}
      {bureausPresent.length < 2 && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              You need reports from at least 2 bureaus to run a comparison.
              Currently uploaded: {bureausPresent.length > 0 ? bureausPresent.join(", ") : "none"}.
            </p>
            <Link href="/upload" className="text-primary text-sm hover:underline">
              Upload more reports →
            </Link>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {comparisons && comparisons.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="font-serif text-2xl">{comparisons.length}</div>
                <p className="text-xs text-muted-foreground">Total Discrepancies</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="font-serif text-2xl text-destructive">{highCount}</div>
                <p className="text-xs text-muted-foreground">High Severity</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="font-serif text-2xl">{disputableCount}</div>
                <p className="text-xs text-muted-foreground">Disputable</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="font-serif text-2xl">{bureausPresent.length}</div>
                <p className="text-xs text-muted-foreground">Bureaus Compared</p>
              </CardContent>
            </Card>
          </div>

          {/* Compliance note */}
          <div className="mb-6 p-3 bg-muted/30 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              Discrepancies indicate differences in how your accounts are reported across bureaus.
              They are <strong className="text-foreground">not automatically disputable</strong> — only inaccurate
              information can be disputed under FCRA. Review each item carefully before deciding to dispute.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "all", label: `All (${comparisons.length})` },
              { key: "high", label: `High Risk (${highCount})` },
              { key: "disputable", label: `Disputable (${disputableCount})` },
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

          {/* Discrepancy cards */}
          <div className="space-y-3">
            {filtered.map((d) => (
              <DiscrepancyCard key={d.id} discrepancy={d} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && (!comparisons || comparisons.length === 0) && bureausPresent.length >= 2 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <GitCompare className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">No discrepancies found</p>
            <p className="text-sm text-muted-foreground">
              Your accounts appear consistent across the bureaus you've uploaded.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading comparison data...</div>
      )}
    </AppLayout>
  );
}

function DiscrepancyCard({ discrepancy: d }: { discrepancy: BureauComparison }) {
  const [open, setOpen] = useState(false);
  const sev = SEV_STYLES[d.severity] || SEV_STYLES.low;

  return (
    <Card
      className={`cursor-pointer transition-colors ${sev.border} ${sev.bg}`}
      onClick={() => setOpen(!open)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`text-xs font-bold uppercase ${sev.text}`}>
              {d.severity}
            </Badge>
            <span className="text-sm font-medium">
              {TYPE_LABELS[d.discrepancyType] || d.discrepancyType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {d.isDisputable && (
              <Link href="/disputes">
                <Button variant="outline" size="sm" className="text-xs text-blue-400 border-blue-400/30" onClick={(e) => e.stopPropagation()}>
                  Dispute This →
                </Button>
              </Link>
            )}
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        <p className="text-sm font-medium">{d.creditorName}</p>

        <div className="flex gap-2 mt-2">
          {((d.bureausAffected as string[]) || []).map((b) => (
            <Badge key={b} variant="outline" className="text-xs uppercase">
              {b.slice(0, 2)}
            </Badge>
          ))}
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
            <pre className="text-xs bg-background/50 p-3 rounded-lg whitespace-pre-wrap break-words">
              {JSON.stringify(d.details, null, 2)}
            </pre>
            <p className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              If this discrepancy reflects inaccurate information, you have the right under FCRA § 611
              to dispute it with the affected bureau(s). The bureau must investigate and correct inaccuracies.
              Disputes must be submitted by you directly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
