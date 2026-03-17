import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  BarChart3,
  FileCheck,
  CheckCircle,
  Shield,
  Loader2,
} from "lucide-react";

interface DashboardData {
  reportsUploaded: number;
  disputesGenerated: number;
  issuesDetected: number;
  bureausCovered: string[];
}

interface Tradeline {
  id: string;
  creditorName: string;
  accountType: string;
  accountStatus: string;
  currentBalance: number;
  creditLimit: number;
  utilizationPct: number;
  paymentStatus: string;
  isDerogatory: boolean;
  riskScore: number;
  accountAgeMonths: number;
  bureau: string;
}

interface Dispute {
  id: string;
  bureau: string;
  disputeType: string | null;
  letterSubject: string | null;
  status: string;
}

const REPORT_INCLUDES = [
  "Credit profile overview and key metrics",
  "Full tradeline breakdown with risk scores",
  "AI-powered recommendations (if analysis was run)",
  "Dispute letter summary",
  "Bureau-specific dispute instructions",
  "FCRA rights reference",
  "Legal disclaimers",
];

export default function ReportPage() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [ackd, setAckd] = useState(false);

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user,
  });

  const { data: tradelines } = useQuery<Tradeline[]>({
    queryKey: ["/api/tradelines", user?.id],
    enabled: !!user,
  });

  const { data: disputes } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes", user?.id],
    enabled: !!user,
  });

  const downloadReport = async () => {
    if (!user || !tradelines) return;
    setGenerating(true);

    try {
      const html = buildReportHTML({
        userName: user.fullName,
        tradelines: tradelines || [],
        disputes: disputes || [],
        reportsCount: dashboard?.reportsUploaded || 0,
        bureaus: dashboard?.bureausCovered || [],
      });

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SCS-Credit-Report-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Report generation failed. Please try again.");
    }
    setGenerating(false);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-serif mb-2">Download Your Credit Report</h1>
          <p className="text-muted-foreground">
            Your full credit analysis, tradeline breakdown, and dispute summary — compiled into a
            professional PDF-ready report.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="font-serif text-2xl">{dashboard?.reportsUploaded ?? 0}</div>
              <p className="text-xs text-muted-foreground">Reports Uploaded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-5 w-5 text-blue-400 mx-auto mb-2" />
              <div className="font-serif text-2xl">{tradelines?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground">Tradelines Analyzed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileCheck className="h-5 w-5 text-green-400 mx-auto mb-2" />
              <div className="font-serif text-2xl">{disputes?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground">Dispute Letters</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Includes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Report Includes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {REPORT_INCLUDES.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-primary">Before Downloading</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This report is provided for <strong className="text-foreground">educational purposes only</strong>.
              By downloading, you acknowledge:
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
              <li>Sterling Credit Solutions does not guarantee any credit score improvement</li>
              <li>No legal or financial advice is contained in this report</li>
              <li>Accurate negative information cannot be guaranteed to be removed by disputing</li>
              <li>You are solely responsible for reviewing and acting on this information</li>
              <li>You will review any dispute letters before sending them yourself</li>
            </ul>

            <div className="flex items-start gap-3 pt-2">
              <Checkbox id="report-ack" checked={ackd} onCheckedChange={(v) => setAckd(!!v)} className="mt-0.5" />
              <label htmlFor="report-ack" className="text-xs cursor-pointer">
                I understand and acknowledge the above statements
              </label>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full mb-4" onClick={downloadReport} disabled={!ackd || generating} size="lg">
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download Full Report (HTML/PDF)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center mb-6">
          Open the downloaded HTML file in any browser and use <strong>File → Print → Save as PDF</strong> for a PDF version.
        </p>

        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              <strong className="text-muted-foreground">Sterling Credit Solutions</strong> · Alice, TX · txscs.com · (361) 660-3993
              <br />
              Providing educational credit tools to aspiring homeowners in South Texas.
              Operating as a Credit Services Organization under Texas law.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function buildReportHTML(data: {
  userName: string;
  tradelines: Tradeline[];
  disputes: Dispute[];
  reportsCount: number;
  bureaus: string[];
}) {
  const { userName, tradelines, disputes, reportsCount, bureaus } = data;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const derogCount = tradelines.filter((t) => t.isDerogatory).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sterling Credit Solutions — Credit Analysis Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;color:#1a1a2e;background:white;line-height:1.5}
.cover{background:#0d1117;color:white;padding:60px;min-height:100vh;display:flex;flex-direction:column}
.cover-logo{font-family:'DM Serif Display';font-size:32px;color:#c89b17}
.cover-title{font-family:'DM Serif Display';font-size:48px;line-height:1.1;margin-top:80px;margin-bottom:16px}
.cover-sub{font-size:18px;color:#8b949e;margin-bottom:32px}
.cover-meta{font-size:14px;color:#8b949e}
.cover-meta span{color:#e6edf3;font-weight:600}
.cover-disclaimer{margin-top:40px;padding:16px 20px;background:#1a1500;border-left:3px solid #c89b17;font-size:11px;color:#8b949e;line-height:1.6}
.section{padding:40px 56px;border-bottom:1px solid #e5e7eb}
.section-title{font-family:'DM Serif Display';font-size:26px;color:#0d1117;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#0d1117;color:white;padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase}
td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
tr:nth-child(even) td{background:#f9fafb}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.badge-derog{background:#fee2e2;color:#991b1b}
.badge-open{background:#d1fae5;color:#065f46}
.footer{padding:24px 56px;background:#0d1117;color:#8b949e;font-size:10px;line-height:1.6}
.footer strong{color:#c89b17}
</style>
</head>
<body>
<div class="cover">
<div class="cover-logo">Sterling Credit Solutions</div>
<div class="cover-title">Credit Analysis<br>Report</div>
<div class="cover-sub">Personalized Credit Profile & Optimization Guide</div>
<div class="cover-meta">
Prepared for: <span>${userName}</span><br>
Report Date: <span>${date}</span><br>
Bureaus Analyzed: <span>${bureaus.map((b) => b.charAt(0).toUpperCase() + b.slice(1)).join(", ") || "None"}</span>
</div>
<div class="cover-disclaimer">
<strong>IMPORTANT:</strong> This report is for educational purposes only. Sterling Credit Solutions does not provide legal or financial advice. No guarantee of credit score improvement.
</div>
</div>
<div class="section">
<div class="section-title">Tradeline Breakdown</div>
<table>
<thead><tr><th>Creditor</th><th>Type</th><th>Status</th><th>Balance</th><th>Limit</th><th>Util%</th><th>Payment</th><th>Risk</th></tr></thead>
<tbody>
${tradelines
  .map(
    (tl) => `<tr>
<td>${tl.creditorName}</td>
<td>${tl.accountType}</td>
<td><span class="badge ${tl.isDerogatory ? "badge-derog" : "badge-open"}">${tl.accountStatus}</span></td>
<td>$${(tl.currentBalance || 0).toLocaleString()}</td>
<td>${tl.creditLimit ? "$" + tl.creditLimit.toLocaleString() : "N/A"}</td>
<td>${tl.utilizationPct != null ? tl.utilizationPct.toFixed(0) + "%" : "N/A"}</td>
<td>${tl.paymentStatus}</td>
<td>${tl.riskScore}/100</td>
</tr>`
  )
  .join("")}
</tbody>
</table>
</div>
<div class="section">
<div class="section-title">Dispute Summary</div>
${
  disputes.length > 0
    ? disputes.map((d) => `<p style="margin-bottom:8px;font-size:13px"><strong>${d.bureau}</strong>: ${d.letterSubject} (${d.status})</p>`).join("")
    : '<p style="color:#6b7280">No dispute letters generated.</p>'
}
</div>
<div class="footer">
<strong>Sterling Credit Solutions</strong> · Alice, Texas · txscs.com · (361) 660-3993<br>
Generated on ${date}. Educational purposes only. © ${new Date().getFullYear()} Sterling Credit Solutions.
</div>
</body>
</html>`;
}
