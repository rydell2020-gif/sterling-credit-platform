// server/lib/pdf.ts
// Generate a downloadable PDF credit report using pdfkit.
// Includes: cover, executive summary, AI analysis, tradelines, disputes,
// FCRA rights reference, and mandatory legal disclaimers.

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

const GOLD = "#C89A2E";
const DARK = "#0E0F12";
const MUTED = "#6B7280";

export interface ReportPayload {
  user: { fullName: string; email: string };
  reportsUploaded: number;
  disputesGenerated: number;
  issuesDetected: number;
  bureausCovered: string[];
  tradelines: Array<{
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
  }>;
  disputes: Array<{
    bureau: string;
    disputeType: string | null;
    letterSubject: string | null;
    status: string;
    createdAt?: string | null;
    creditorName?: string | null;
  }>;
  analysis: null | {
    recommendations: Array<{ priority: string; category: string; title: string; description: string; impact: string }>;
    priority_actions: Array<{ title: string; description: string; timeline: string }>;
    risk_assessment: { overall_risk: string; key_concern: string; positive_factors: string[]; improvement_areas: string[] };
    educational_notes?: string[];
  };
  options: {
    includeAnalysis: boolean;
    includeTradelines: boolean;
    includeDisputes: boolean;
    includeFCRAReference: boolean;
    includeDisclaimers: boolean;
  };
}

function h1(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.6);
  doc.fillColor(GOLD).fontSize(18).font("Helvetica-Bold").text(text);
  doc.moveTo(doc.x, doc.y + 4).lineTo(550, doc.y + 4).strokeColor(GOLD).lineWidth(0.8).stroke();
  doc.moveDown(0.6);
  doc.fillColor(DARK).font("Helvetica").fontSize(10);
}

function h2(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.4);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12).text(text);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10);
}

function keyVal(doc: PDFKit.PDFDocument, k: string, v: string) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text(k, { continued: true });
  doc.font("Helvetica").fillColor(DARK).text("  " + v);
}

function fmtMoney(n: number | null | undefined) {
  const v = Number(n || 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number | null | undefined) {
  const v = Number(n || 0);
  return v.toFixed(0) + "%";
}

export async function generatePDF(payload: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      const stream = new PassThrough();
      stream.on("data", (c) => chunks.push(c as Buffer));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
      doc.pipe(stream);

      // ---- Cover ----
      doc
        .rect(0, 0, doc.page.width, 130)
        .fill(DARK);
      doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(22).text("STERLING CREDIT SOLUTIONS", 50, 40);
      doc.fillColor("#FFFFFF").font("Helvetica").fontSize(11).text("Credit Analysis & Dispute Report", 50, 72);
      doc.fillColor(MUTED).fontSize(9).text("Educational purposes only • Not legal advice", 50, 90);

      doc.y = 160;
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16).text("Credit Report Summary");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Prepared for: ${payload.user.fullName}`);
      doc.text(`Email: ${payload.user.email}`);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);

      // ---- Executive Summary ----
      h1(doc, "Executive Summary");
      keyVal(doc, "Reports uploaded:", String(payload.reportsUploaded));
      keyVal(doc, "Bureaus covered:", payload.bureausCovered.length ? payload.bureausCovered.map((b) => b.toUpperCase()).join(", ") : "None");
      keyVal(doc, "Issues detected:", String(payload.issuesDetected));
      keyVal(doc, "Dispute letters generated:", String(payload.disputesGenerated));

      // ---- AI Analysis ----
      if (payload.options.includeAnalysis && payload.analysis) {
        h1(doc, "AI Credit Analysis");
        const a = payload.analysis;
        keyVal(doc, "Overall risk:", String(a.risk_assessment.overall_risk || "").toUpperCase());
        keyVal(doc, "Key concern:", a.risk_assessment.key_concern || "");

        h2(doc, "Priority Actions");
        a.priority_actions.forEach((p, i) => {
          doc.font("Helvetica-Bold").fillColor(DARK).text(`${i + 1}. ${p.title}`);
          doc.font("Helvetica").fillColor(MUTED).text(`   ${p.description}`);
          doc.fillColor(GOLD).text(`   Timeline: ${p.timeline}`);
          doc.moveDown(0.2);
        });

        h2(doc, "Recommendations");
        a.recommendations.forEach((r, i) => {
          const priorityColor = r.priority === "high" ? "#DC2626" : r.priority === "medium" ? GOLD : "#059669";
          doc.font("Helvetica-Bold").fillColor(priorityColor).text(`${i + 1}. [${String(r.priority || "").toUpperCase()}] ${r.title}`);
          doc.font("Helvetica").fillColor(DARK).text(`   Category: ${r.category}`);
          doc.fillColor(MUTED).text(`   ${r.description}`);
          doc.text(`   Impact: ${r.impact}`);
          doc.moveDown(0.3);
        });

        if (a.risk_assessment.positive_factors?.length) {
          h2(doc, "Positive Factors");
          a.risk_assessment.positive_factors.forEach((f) => doc.text("• " + f));
        }
        if (a.risk_assessment.improvement_areas?.length) {
          h2(doc, "Areas for Improvement");
          a.risk_assessment.improvement_areas.forEach((f) => doc.text("• " + f));
        }
      }

      // ---- Tradelines ----
      if (payload.options.includeTradelines && payload.tradelines.length) {
        h1(doc, "Tradelines");
        payload.tradelines.forEach((t, i) => {
          if (doc.y > 700) doc.addPage();
          const isDerog = t.isDerogatory;
          doc.font("Helvetica-Bold").fillColor(isDerog ? "#DC2626" : DARK).fontSize(11)
            .text(`${i + 1}. ${t.creditorName} — ${(t.bureau || "").toUpperCase()}`);
          doc.font("Helvetica").fillColor(MUTED).fontSize(9);
          doc.text(`   ${t.accountType} • ${t.accountStatus}${isDerog ? " • DEROGATORY" : ""}`);
          doc.text(`   Balance ${fmtMoney(t.currentBalance)} / Limit ${fmtMoney(t.creditLimit)} • Utilization ${fmtPct(t.utilizationPct)} • Age ${t.accountAgeMonths}mo • Risk ${t.riskScore}/100`);
          doc.moveDown(0.3);
        });
      }

      // ---- Disputes ----
      if (payload.options.includeDisputes && payload.disputes.length) {
        h1(doc, "Dispute Letters");
        payload.disputes.forEach((d, i) => {
          if (doc.y > 700) doc.addPage();
          doc.font("Helvetica-Bold").fillColor(DARK).fontSize(11).text(`${i + 1}. ${d.letterSubject || d.creditorName || "Dispute"} — ${(d.bureau || "").toUpperCase()}`);
          doc.font("Helvetica").fillColor(MUTED).fontSize(9);
          doc.text(`   Type: ${d.disputeType || "n/a"} • Status: ${d.status}${d.createdAt ? ` • Created: ${new Date(d.createdAt).toLocaleDateString()}` : ""}`);
          doc.moveDown(0.2);
        });

        h2(doc, "Bureau Mailing Addresses");
        doc.font("Helvetica").fillColor(DARK).fontSize(9);
        doc.text("TransUnion: P.O. Box 2000, Chester, PA 19016-2000");
        doc.text("Equifax: P.O. Box 740256, Atlanta, GA 30374");
        doc.text("Experian: P.O. Box 4500, Allen, TX 75013");
        doc.moveDown(0.2);
        doc.fillColor(MUTED).fontSize(8).text("Send disputes via USPS Certified Mail with Return Receipt.");
      }

      // ---- FCRA Reference ----
      if (payload.options.includeFCRAReference) {
        h1(doc, "Your FCRA Rights");
        const rights = [
          "You have the right to a free copy of your credit report every 12 months from annualcreditreport.com.",
          "You have the right to dispute inaccurate or incomplete information (FCRA § 611).",
          "The bureau has 30 days (45 if extended) to investigate your dispute.",
          "You have the right to add a 100-word statement of dispute to your file.",
          "You have the right to know who has accessed your credit report.",
          "You have the right to have negative information removed after 7 years (FCRA § 605); Chapter 7 bankruptcy after 10 years.",
          "You have the right to sue for violations of the FCRA.",
        ];
        doc.font("Helvetica").fillColor(DARK).fontSize(10);
        rights.forEach((r) => doc.text("• " + r));
      }

      // ---- Disclaimers ----
      if (payload.options.includeDisclaimers) {
        h1(doc, "Legal Disclaimers");
        doc.font("Helvetica").fillColor(DARK).fontSize(9);
        doc.text(
          "Sterling Credit Solutions is a Texas-registered Credit Services Organization (CSO). We are not a law firm and do not provide legal advice. All content in this report is educational and intended to help you understand your rights under the Fair Credit Reporting Act (FCRA) and the Credit Repair Organizations Act (CROA). No specific outcome, score change, or timeline is guaranteed. You retain the right to dispute inaccurate information directly with the credit bureaus without paying any organization to do so.",
          { align: "justify" },
        );
        doc.moveDown(0.3);
        doc.text(
          "Under CROA (15 U.S.C. § 1679e), you have a right to cancel this service within three (3) business days of your enrollment without penalty. Any AI-generated recommendations and dispute letter templates are provided as-is; you are responsible for reviewing, personalizing, and signing any letter before mailing.",
          { align: "justify" },
        );
        doc.moveDown(0.4);
        doc.fillColor(MUTED).fontSize(8).text("© Sterling Credit Solutions • Corpus Christi, TX • sterlingcredit.com");
      }

      // ---- Page numbers (must not trigger auto page-add) ----
      const range = doc.bufferedPageRange();
      const total = range.count;
      for (let i = 0; i < total; i++) {
        doc.switchToPage(range.start + i);
        // Disable auto page wrapping so the footer never spawns a new blank page.
        const originalBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fillColor(MUTED)
          .fontSize(8)
          .font("Helvetica")
          .text(`Page ${i + 1} of ${total}`, 50, doc.page.height - 30, {
            align: "center",
            width: doc.page.width - 100,
            lineBreak: false,
          });
        doc.page.margins.bottom = originalBottom;
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
