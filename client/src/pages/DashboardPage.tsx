import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { MessagesCard } from "@/components/MessagesCard";
import {
  FileText,
  AlertTriangle,
  FileCheck,
  Shield,
  Upload,
  BarChart3,
  FileSearch,
  GitCompare,
  Download,
  ChevronRight,
} from "lucide-react";

const BUREAU_MAP: Record<string, { label: string; abbr: string; color: string }> = {
  transunion: { label: "TransUnion", abbr: "TU", color: "bg-blue-600" },
  equifax: { label: "Equifax", abbr: "EQ", color: "bg-red-600" },
  experian: { label: "Experian", abbr: "EX", color: "bg-indigo-600" },
};

const JOURNEY_STEPS = [
  { step: 1, title: "Upload Reports", description: "Upload credit reports from all 3 bureaus", icon: Upload, href: "/upload" },
  { step: 2, title: "Review Analysis", description: "AI analyzes your tradelines and finds issues", icon: BarChart3, href: "/analysis" },
  { step: 3, title: "Generate Disputes", description: "Create FCRA dispute letters for inaccuracies", icon: FileSearch, href: "/disputes" },
  { step: 4, title: "Compare Bureaus", description: "Find cross-bureau discrepancies", icon: GitCompare, href: "/comparison" },
  { step: 5, title: "Download Report", description: "Get your full credit analysis report", icon: Download, href: "/report" },
];

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: dashboard } = useQuery<{
    reportsUploaded: number;
    disputesGenerated: number;
    issuesDetected: number;
    bureausCovered: string[];
    recentReports: Array<{ id: string; bureau: string; fileName: string; status: string; createdAt: string }>;
  }>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user,
  });

  const stats = [
    { label: "Reports Uploaded", value: dashboard?.reportsUploaded ?? 0, icon: FileText, color: "text-primary" },
    { label: "Issues Detected", value: dashboard?.issuesDetected ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: "Disputes Generated", value: dashboard?.disputesGenerated ?? 0, icon: FileCheck, color: "text-blue-400" },
    { label: "Bureaus Covered", value: `${dashboard?.bureausCovered?.length ?? 0}/3`, icon: Shield, color: "text-green-400" },
  ];

  const allBureaus = ["transunion", "equifax", "experian"];
  const coveredBureaus = dashboard?.bureausCovered || [];

  return (
    <AppLayout>
      {/* Compliance banner */}
      <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-primary">Educational Platform</strong> — Sterling Credit Solutions provides
          educational tools only. We do not provide legal or financial advice. No guaranteed results.
        </p>
      </div>

      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif">Welcome back, {user?.fullName?.split(" ")[0] || "there"}</h1>
        <p className="text-muted-foreground mt-1">Here's your credit repair progress overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="font-serif text-3xl">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bureau coverage */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Bureau Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {allBureaus.map((b) => {
              const bureau = BUREAU_MAP[b];
              const isCovered = coveredBureaus.includes(b);
              return (
                <div
                  key={b}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    isCovered ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"
                  }`}
                >
                  <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white ${bureau.color}`}>
                    {bureau.abbr}
                  </div>
                  <span className="text-sm">{bureau.label}</span>
                  {isCovered ? (
                    <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      Missing
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Messages from advisor */}
      <MessagesCard />

      {/* DIY Credit Journey */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-serif text-lg">DIY Credit Journey</CardTitle>
          <p className="text-sm text-muted-foreground">Follow these 5 steps to improve your credit profile.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {JOURNEY_STEPS.map((step) => (
              <Link key={step.step} href={step.href}>
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif text-sm">
                    {step.step}
                  </div>
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent reports */}
      {dashboard?.recentReports && dashboard.recentReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard.recentReports.map((report) => {
                const bureau = BUREAU_MAP[report.bureau];
                return (
                  <div key={report.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center text-white ${bureau?.color || "bg-gray-600"}`}>
                      {bureau?.abbr || "?"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{report.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "Unknown date"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {report.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Link href="/upload">
                <Button variant="outline" size="sm" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload More Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
