import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  users, creditReports, tradelines, disputes,
  aiAnalyses, bureauComparisons, auditLogs,
} from "@shared/schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required. Set it in .env or pass it as an environment variable.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Seeding database...");

  // Demo user
  const [demoUser] = await db.insert(users).values({
    id: "demo-user-1",
    email: "demo@sterlingcredit.com",
    password: "demo123",
    fullName: "Maria Rodriguez",
    role: "user",
    croaDisclosureAcknowledged: true,
    csoConsent: true,
    rightToCancelExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  }).returning();
  console.log("  Created demo user:", demoUser.email);

  // Admin user
  const [adminUser] = await db.insert(users).values({
    id: "admin-user-1",
    email: "admin@sterlingcredit.com",
    password: "admin123",
    fullName: "Sterling Admin",
    role: "admin",
    croaDisclosureAcknowledged: true,
    csoConsent: true,
    rightToCancelExpiresAt: null,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  }).returning();
  console.log("  Created admin user:", adminUser.email);

  // Credit reports
  const reportData = [
    { bureau: "transunion", score: 628, status: "parsed" },
    { bureau: "equifax", score: 635, status: "parsed" },
    { bureau: "experian", score: 621, status: "parsed" },
  ];
  for (let i = 0; i < reportData.length; i++) {
    const r = reportData[i];
    await db.insert(creditReports).values({
      id: `report-${i + 1}`,
      userId: "demo-user-1",
      bureau: r.bureau,
      fileName: `${r.bureau}-report.pdf`,
      fileSize: 245000 + i * 10000,
      status: r.status,
      rawScore: r.score,
      createdAt: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
    });
  }
  console.log("  Created 3 credit reports");

  // Tradelines
  const tradelineData = [
    {
      userId: "demo-user-1", reportId: "report-1",
      creditorName: "Chase Bank", accountNumber: "****4521",
      accountType: "Credit Card", accountStatus: "open",
      currentBalance: 3450, creditLimit: 8000, utilizationPct: 43.1,
      paymentStatus: "current", accountAgeMonths: 36,
      riskScore: 45, isDerogatory: false, isDisputable: true,
      disputeReason: "High utilization reported inconsistently across bureaus",
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "transunion",
    },
    {
      userId: "demo-user-1", reportId: "report-1",
      creditorName: "Capital One", accountNumber: "****7832",
      accountType: "Credit Card", accountStatus: "open",
      currentBalance: 1200, creditLimit: 5000, utilizationPct: 24.0,
      paymentStatus: "current", accountAgeMonths: 48,
      riskScore: 25, isDerogatory: false, isDisputable: false,
      disputeReason: null,
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "transunion",
    },
    {
      userId: "demo-user-1", reportId: "report-1",
      creditorName: "Midland Credit Mgmt", accountNumber: "****9901",
      accountType: "Collection", accountStatus: "collection",
      currentBalance: 2847, creditLimit: 0, utilizationPct: 0,
      paymentStatus: "collection", accountAgeMonths: 18,
      riskScore: 92, isDerogatory: true, isDisputable: true,
      disputeReason: "Unverified debt — original creditor not confirmed",
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "equifax",
    },
    {
      userId: "demo-user-1", reportId: "report-2",
      creditorName: "Wells Fargo Auto", accountNumber: "****3344",
      accountType: "Auto Loan", accountStatus: "open",
      currentBalance: 12500, creditLimit: 22000, utilizationPct: 56.8,
      paymentStatus: "30 days late", accountAgeMonths: 24,
      riskScore: 65, isDerogatory: false, isDisputable: true,
      disputeReason: "Late payment reported but payment was made on time — bank processing delay",
      times30DaysLate: 1, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "equifax",
    },
    {
      userId: "demo-user-1", reportId: "report-2",
      creditorName: "Synchrony / Amazon", accountNumber: "****5567",
      accountType: "Credit Card", accountStatus: "closed",
      currentBalance: 0, creditLimit: 3000, utilizationPct: 0,
      paymentStatus: "paid", accountAgeMonths: 60,
      riskScore: 10, isDerogatory: false, isDisputable: false,
      disputeReason: null,
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "experian",
    },
    {
      userId: "demo-user-1", reportId: "report-3",
      creditorName: "Portfolio Recovery", accountNumber: "****1122",
      accountType: "Collection", accountStatus: "collection",
      currentBalance: 1450, creditLimit: 0, utilizationPct: 0,
      paymentStatus: "collection", accountAgeMonths: 14,
      riskScore: 88, isDerogatory: true, isDisputable: true,
      disputeReason: "Account age exceeds 7-year FCRA reporting period",
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "experian",
    },
    {
      userId: "demo-user-1", reportId: "report-3",
      creditorName: "Discover", accountNumber: "****8899",
      accountType: "Credit Card", accountStatus: "open",
      currentBalance: 780, creditLimit: 4500, utilizationPct: 17.3,
      paymentStatus: "current", accountAgeMonths: 30,
      riskScore: 20, isDerogatory: false, isDisputable: false,
      disputeReason: null,
      times30DaysLate: 0, times60DaysLate: 0, times90DaysLate: 0,
      bureau: "transunion",
    },
    {
      userId: "demo-user-1", reportId: "report-1",
      creditorName: "USAA", accountNumber: "****6677",
      accountType: "Personal Loan", accountStatus: "charged_off",
      currentBalance: 4200, creditLimit: 0, utilizationPct: 0,
      paymentStatus: "charged off", accountAgeMonths: 42,
      riskScore: 95, isDerogatory: true, isDisputable: true,
      disputeReason: "Balance reported incorrectly — partial payments not reflected",
      times30DaysLate: 3, times60DaysLate: 2, times90DaysLate: 1,
      bureau: "transunion",
    },
  ];
  for (let i = 0; i < tradelineData.length; i++) {
    await db.insert(tradelines).values({
      id: `tl-${i + 1}`,
      ...tradelineData[i],
    });
  }
  console.log("  Created 8 tradelines");

  // Dispute
  const disputeDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  await db.insert(disputes).values({
    id: "dispute-1",
    userId: "demo-user-1",
    tradelineId: "tl-3",
    bureau: "equifax",
    disputeType: "unverified_debt",
    letterSubject: "Dispute — Midland Credit Mgmt Collection Account ****9901",
    letterBody: `[YOUR FULL NAME]\n[YOUR ADDRESS]\n[CITY, STATE ZIP]\n\nDate: ${disputeDate}\n\nEquifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374\n\nRe: Dispute of Inaccurate Information — Account ****9901\n\nTo Whom It May Concern:\n\nPursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681i (Section 611), I am writing to dispute the following information appearing on my credit report.\n\nAccount: Midland Credit Mgmt — ****9901\nReason for Dispute: This collection account is unverified. The original creditor has not been confirmed, and I request full verification of this debt including the original creditor name, original account number, and signed agreement.\n\nI request that this item be investigated and, if it cannot be verified within 30 days, removed from my credit report in accordance with FCRA § 611(a)(5)(A).\n\nPlease send me written confirmation of the results of your investigation.\n\nSincerely,\n[YOUR FULL NAME]\n\n---\nDISCLAIMER: This letter was generated as an educational template by Sterling Credit Solutions. SCS does not guarantee any outcome. You must review, personalize, and submit this letter yourself.`,
    creditorName: "Midland Credit Mgmt",
    status: "draft",
    disclaimerAcknowledged: false,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  });
  console.log("  Created 1 dispute");

  // AI Analysis
  await db.insert(aiAnalyses).values({
    id: "analysis-1",
    userId: "demo-user-1",
    recommendations: [
      {
        priority: "high",
        category: "Collections",
        title: "Dispute unverified collection accounts",
        description: "You have 2 collection accounts that may be disputable. Midland Credit Mgmt and Portfolio Recovery should be verified — request debt validation under FDCPA.",
        impact: "Removing unverified collections could significantly improve your score by 40-80 points.",
      },
      {
        priority: "high",
        category: "Payment History",
        title: "Address late payment on Wells Fargo Auto",
        description: "The 30-day late payment on your auto loan is impacting your score. If this was reported in error, dispute it with supporting documentation.",
        impact: "Correcting a single late payment could improve your score by 20-40 points.",
      },
      {
        priority: "medium",
        category: "Utilization",
        title: "Reduce Chase card utilization below 30%",
        description: "Your Chase card is at 43% utilization. Paying down ~$1,050 would bring it under the 30% threshold.",
        impact: "Lowering utilization to under 30% could improve your score by 10-25 points.",
      },
      {
        priority: "low",
        category: "Account Mix",
        title: "Maintain open accounts in good standing",
        description: "Your Discover and Capital One cards are in good standing. Continue making on-time payments to build positive history.",
        impact: "Consistent on-time payments strengthen your profile over time.",
      },
    ],
    priorityActions: [
      "Dispute Midland Credit Mgmt collection with Equifax",
      "Dispute Portfolio Recovery collection with Experian",
      "Contest Wells Fargo late payment with Equifax",
      "Pay down Chase card to below $2,400",
    ],
    riskAssessment: {
      overallRisk: "medium-high",
      derogatoryCount: 3,
      utilizationAvg: 28.4,
      oldestAccount: "5 years",
    },
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  });
  console.log("  Created 1 AI analysis");

  // Bureau comparisons
  const comparisonData = [
    {
      userId: "demo-user-1",
      discrepancyType: "balance_mismatch",
      creditorName: "Chase Bank",
      accountNumber: "****4521",
      bureausAffected: ["transunion", "equifax"],
      details: { transunion: "$3,450", equifax: "$3,670", difference: "$220" },
      severity: "medium",
      isDisputable: true,
    },
    {
      userId: "demo-user-1",
      discrepancyType: "status_mismatch",
      creditorName: "USAA",
      accountNumber: "****6677",
      bureausAffected: ["transunion", "experian"],
      details: { transunion: "Charged Off", experian: "Collection", note: "Different status for same account" },
      severity: "high",
      isDisputable: true,
    },
    {
      userId: "demo-user-1",
      discrepancyType: "missing_account",
      creditorName: "Discover",
      accountNumber: "****8899",
      bureausAffected: ["equifax"],
      details: { note: "Account appears on TransUnion and Experian but not Equifax" },
      severity: "low",
      isDisputable: false,
    },
  ];
  for (let i = 0; i < comparisonData.length; i++) {
    await db.insert(bureauComparisons).values({
      id: `comp-${i + 1}`,
      ...comparisonData[i],
    });
  }
  console.log("  Created 3 bureau comparisons");

  // Audit logs
  const logData = [
    { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-1", metadata: { bureau: "transunion" }, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-2", metadata: { bureau: "equifax" }, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-3", metadata: { bureau: "experian" }, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { userId: "demo-user-1", action: "analyze", resource: "ai_analyses", resourceId: "analysis-1", metadata: { model: "claude-sonnet" }, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
    { userId: "demo-user-1", action: "dispute_generated", resource: "disputes", resourceId: "dispute-1", metadata: { bureau: "equifax" }, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
  for (let i = 0; i < logData.length; i++) {
    await db.insert(auditLogs).values({
      id: `log-${i + 1}`,
      ...logData[i],
    });
  }
  console.log("  Created 5 audit logs");

  console.log("\nSeed complete!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
