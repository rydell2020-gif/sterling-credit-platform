import {
  type User, type InsertUser,
  type CreditReport, type Tradeline, type Dispute,
  type AIAnalysis, type BureauComparison, type AuditLog,
  type Expense, type InsertExpense,
  type Message, type CalendarEvent, type Document
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Credit Reports
  getCreditReports(userId: string): Promise<CreditReport[]>;
  createCreditReport(report: Omit<CreditReport, "id">): Promise<CreditReport>;

  // Tradelines
  getTradelines(userId: string): Promise<Tradeline[]>;
  getTradelineById(id: string): Promise<Tradeline | undefined>;
  createTradeline(tl: Omit<Tradeline, "id">): Promise<Tradeline>;

  // Disputes
  getDisputes(userId: string): Promise<Dispute[]>;
  createDispute(d: Omit<Dispute, "id">): Promise<Dispute>;
  updateDispute(id: string, data: Partial<Dispute>): Promise<Dispute | undefined>;

  // AI Analyses
  getAnalyses(userId: string): Promise<AIAnalysis[]>;
  createAnalysis(a: Omit<AIAnalysis, "id">): Promise<AIAnalysis>;

  // Bureau Comparisons
  getComparisons(userId: string): Promise<BureauComparison[]>;
  createComparison(c: Omit<BureauComparison, "id">): Promise<BureauComparison>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: Omit<AuditLog, "id">): Promise<AuditLog>;

  // Expenses
  getExpenses(userId: string, scope?: string): Promise<Expense[]>;
  getAllExpenses(scope?: string): Promise<Expense[]>;
  createExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: string, data: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  // Messages
  getMessages(clientId: string): Promise<Message[]>;
  getUnreadCount(clientId: string, forRole: string): Promise<number>;
  createMessage(m: Omit<Message, "id">): Promise<Message>;
  markMessagesRead(clientId: string, forRole: string): Promise<void>;

  // Calendar Events
  getCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  getAllCalendarEvents(): Promise<CalendarEvent[]>;
  createCalendarEvent(e: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  generateFcraEventsForDispute(dispute: Dispute): Promise<CalendarEvent[]>;

  // Documents
  getDocuments(userId: string): Promise<Document[]>;
  createDocument(d: Omit<Document, "id">): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;

  // User cascade delete
  deleteUser(id: string): Promise<boolean>;

  // Stats
  getStats(): Promise<{ users: number; reports: number; disputes: number; analyses: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private creditReports: Map<string, CreditReport> = new Map();
  private tradelinesMap: Map<string, Tradeline> = new Map();
  private disputesMap: Map<string, Dispute> = new Map();
  private analysesMap: Map<string, AIAnalysis> = new Map();
  private comparisonsMap: Map<string, BureauComparison> = new Map();
  private auditLogsMap: Map<string, AuditLog> = new Map();
  private expenses: Map<string, Expense> = new Map();
  private messagesMap: Map<string, Message> = new Map();
  private calendarEvents: Map<string, CalendarEvent> = new Map();
  private documents: Map<string, Document> = new Map();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // Create demo user
    const demoUser: User = {
      id: "demo-user-1",
      email: "demo@sterlingcredit.com",
      password: "demo123",
      fullName: "Maria Rodriguez",
      role: "user",
      croaDisclosureAcknowledged: true,
      csoConsent: true,
      rightToCancelExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    };
    this.users.set(demoUser.id, demoUser);

    // Admin user
    const adminUser: User = {
      id: "admin-user-1",
      email: "admin@sterlingcredit.com",
      password: "admin123",
      fullName: "Sterling Admin",
      role: "admin",
      croaDisclosureAcknowledged: true,
      csoConsent: true,
      rightToCancelExpiresAt: null,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // Credit reports
    const reports = [
      { bureau: "transunion", score: 628, status: "parsed" },
      { bureau: "equifax", score: 635, status: "parsed" },
      { bureau: "experian", score: 621, status: "parsed" },
    ];
    reports.forEach((r, i) => {
      const id = `report-${i + 1}`;
      this.creditReports.set(id, {
        id,
        userId: "demo-user-1",
        bureau: r.bureau,
        fileName: `${r.bureau}-report.pdf`,
        fileSize: 245000 + i * 10000,
        status: r.status,
        rawScore: r.score,
        createdAt: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
      });
    });

    // Tradelines
    const sampleTradelines: Omit<Tradeline, "id">[] = [
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

    sampleTradelines.forEach((tl, i) => {
      const id = `tl-${i + 1}`;
      this.tradelinesMap.set(id, { ...tl, id });
    });

    // Sample disputes
    const sampleDisputes: Omit<Dispute, "id">[] = [
      {
        userId: "demo-user-1",
        tradelineId: "tl-3",
        bureau: "equifax",
        disputeType: "unverified_debt",
        letterSubject: "Dispute — Midland Credit Mgmt Collection Account ****9901",
        letterBody: `[YOUR FULL NAME]\n[YOUR ADDRESS]\n[CITY, STATE ZIP]\n\nDate: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n\nEquifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374\n\nRe: Dispute of Inaccurate Information — Account ****9901\n\nTo Whom It May Concern:\n\nPursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681i (Section 611), I am writing to dispute the following information appearing on my credit report.\n\nAccount: Midland Credit Mgmt — ****9901\nReason for Dispute: This collection account is unverified. The original creditor has not been confirmed, and I request full verification of this debt including the original creditor name, original account number, and signed agreement.\n\nI request that this item be investigated and, if it cannot be verified within 30 days, removed from my credit report in accordance with FCRA § 611(a)(5)(A).\n\nPlease send me written confirmation of the results of your investigation.\n\nSincerely,\n[YOUR FULL NAME]\n\n---\nDISCLAIMER: This letter was generated as an educational template by Sterling Credit Solutions. SCS does not guarantee any outcome. You must review, personalize, and submit this letter yourself.`,
        creditorName: "Midland Credit Mgmt",
        status: "draft",
        disclaimerAcknowledged: false,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ];

    sampleDisputes.forEach((d, i) => {
      const id = `dispute-${i + 1}`;
      this.disputesMap.set(id, { ...d, id });
    });

    // Sample AI analysis
    const analysis: AIAnalysis = {
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
      ] as unknown,
      priorityActions: [
        "Dispute Midland Credit Mgmt collection with Equifax",
        "Dispute Portfolio Recovery collection with Experian",
        "Contest Wells Fargo late payment with Equifax",
        "Pay down Chase card to below $2,400",
      ] as unknown,
      riskAssessment: {
        overallRisk: "medium-high",
        derogatoryCount: 3,
        utilizationAvg: 28.4,
        oldestAccount: "5 years",
      } as unknown,
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    };
    this.analysesMap.set(analysis.id, analysis);

    // Sample comparisons
    const comparisons: Omit<BureauComparison, "id">[] = [
      {
        userId: "demo-user-1",
        discrepancyType: "balance_mismatch",
        creditorName: "Chase Bank",
        accountNumber: "****4521",
        bureausAffected: ["transunion", "equifax"] as unknown,
        details: { transunion: "$3,450", equifax: "$3,670", difference: "$220" } as unknown,
        severity: "medium",
        isDisputable: true,
      },
      {
        userId: "demo-user-1",
        discrepancyType: "status_mismatch",
        creditorName: "USAA",
        accountNumber: "****6677",
        bureausAffected: ["transunion", "experian"] as unknown,
        details: { transunion: "Charged Off", experian: "Collection", note: "Different status for same account" } as unknown,
        severity: "high",
        isDisputable: true,
      },
      {
        userId: "demo-user-1",
        discrepancyType: "missing_account",
        creditorName: "Discover",
        accountNumber: "****8899",
        bureausAffected: ["equifax"] as unknown,
        details: { note: "Account appears on TransUnion and Experian but not Equifax" } as unknown,
        severity: "low",
        isDisputable: false,
      },
    ];
    comparisons.forEach((c, i) => {
      const id = `comp-${i + 1}`;
      this.comparisonsMap.set(id, { ...c, id });
    });

    // Audit logs
    const logs: Omit<AuditLog, "id">[] = [
      { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-1", metadata: { bureau: "transunion" } as unknown, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
      { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-2", metadata: { bureau: "equifax" } as unknown, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
      { userId: "demo-user-1", action: "upload", resource: "credit_reports", resourceId: "report-3", metadata: { bureau: "experian" } as unknown, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { userId: "demo-user-1", action: "analyze", resource: "ai_analyses", resourceId: "analysis-1", metadata: { model: "claude-sonnet" } as unknown, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
      { userId: "demo-user-1", action: "dispute_generated", resource: "disputes", resourceId: "dispute-1", metadata: { bureau: "equifax" } as unknown, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    ];
    logs.forEach((l, i) => {
      const id = `log-${i + 1}`;
      this.auditLogsMap.set(id, { ...l, id });
    });

    // ===== Expenses =====
    const sampleExpenses: Omit<Expense, "id">[] = [
      // Personal (Maria)
      { userId: "demo-user-1", scope: "personal", category: "rent", vendor: "Oakwood Apartments", amount: 1450, currency: "USD", occurredOn: "2025-06-01", paymentMethod: "ach", notes: "Monthly rent", receiptUrl: null, isRecurring: true, createdAt: new Date("2025-06-01").toISOString() },
      { userId: "demo-user-1", scope: "personal", category: "food", vendor: "H-E-B", amount: 340, currency: "USD", occurredOn: "2025-06-05", paymentMethod: "debit", notes: "Groceries", receiptUrl: null, isRecurring: false, createdAt: new Date("2025-06-05").toISOString() },
      { userId: "demo-user-1", scope: "personal", category: "transport", vendor: "Shell", amount: 180, currency: "USD", occurredOn: "2025-06-08", paymentMethod: "credit", notes: "Gas", receiptUrl: null, isRecurring: false, createdAt: new Date("2025-06-08").toISOString() },
      { userId: "demo-user-1", scope: "personal", category: "utilities", vendor: "Verizon", amount: 95, currency: "USD", occurredOn: "2025-06-10", paymentMethod: "credit", notes: "Phone bill", receiptUrl: null, isRecurring: true, createdAt: new Date("2025-06-10").toISOString() },
      // Business (Admin)
      { userId: "admin-user-1", scope: "business", category: "ads", vendor: "Facebook Ads", amount: 250, currency: "USD", occurredOn: "2025-06-02", paymentMethod: "credit", notes: "Lead generation campaign", receiptUrl: null, isRecurring: false, createdAt: new Date("2025-06-02").toISOString() },
      { userId: "admin-user-1", scope: "business", category: "software", vendor: "Adobe Creative Cloud", amount: 89, currency: "USD", occurredOn: "2025-06-04", paymentMethod: "credit", notes: "Monthly subscription", receiptUrl: null, isRecurring: true, createdAt: new Date("2025-06-04").toISOString() },
      { userId: "admin-user-1", scope: "business", category: "client_fee", vendor: "IdentityIQ", amount: 299, currency: "USD", occurredOn: "2025-06-06", paymentMethod: "ach", notes: "Client credit monitoring fee", receiptUrl: null, isRecurring: false, createdAt: new Date("2025-06-06").toISOString() },
      { userId: "admin-user-1", scope: "business", category: "mileage", vendor: "Client visit", amount: 42, currency: "USD", occurredOn: "2025-06-09", paymentMethod: "cash", notes: "Mileage reimbursement", receiptUrl: null, isRecurring: false, createdAt: new Date("2025-06-09").toISOString() },
    ];
    sampleExpenses.forEach((e, i) => {
      const id = `exp-${i + 1}`;
      this.expenses.set(id, { ...e, id });
    });

    // ===== Messages (clientId = demo-user-1) =====
    const now = Date.now();
    const sampleMessages: Omit<Message, "id">[] = [
      { clientId: "demo-user-1", senderId: "admin-user-1", senderRole: "admin", body: "Hi Maria! Welcome to Sterling Credit Solutions. I've reviewed your uploaded reports and we have a solid plan to start improving your profile.", attachmentUrl: null, attachmentName: null, readAt: new Date(now - 6 * 86400000).toISOString(), createdAt: new Date(now - 6 * 86400000).toISOString() },
      { clientId: "demo-user-1", senderId: "demo-user-1", senderRole: "user", body: "Thank you! I'm excited to get started. What should I do first?", attachmentUrl: null, attachmentName: null, readAt: new Date(now - 5.5 * 86400000).toISOString(), createdAt: new Date(now - 5.5 * 86400000).toISOString() },
      { clientId: "demo-user-1", senderId: "admin-user-1", senderRole: "admin", body: "Great question. Let's begin with the two collection accounts — those have the highest potential impact on your score.", attachmentUrl: null, attachmentName: null, readAt: new Date(now - 5 * 86400000).toISOString(), createdAt: new Date(now - 5 * 86400000).toISOString() },
      // Most recent 3 from admin, unread by client
      { clientId: "demo-user-1", senderId: "admin-user-1", senderRole: "admin", body: "I've drafted your first dispute letter for the Midland Credit collection. Please review it in the Disputes section.", attachmentUrl: "#", attachmentName: "midland-dispute-draft.pdf", readAt: null, createdAt: new Date(now - 2 * 86400000).toISOString() },
      { clientId: "demo-user-1", senderId: "admin-user-1", senderRole: "admin", body: "Also, remember the FCRA 30-day response window starts once the bureau receives the letter. I've added the deadlines to your calendar.", attachmentUrl: null, attachmentName: null, readAt: null, createdAt: new Date(now - 1 * 86400000).toISOString() },
      { clientId: "demo-user-1", senderId: "admin-user-1", senderRole: "admin", body: "Let me know if you have any questions. We're making great progress!", attachmentUrl: null, attachmentName: null, readAt: null, createdAt: new Date(now - 0.2 * 86400000).toISOString() },
    ];
    sampleMessages.forEach((m, i) => {
      const id = `msg-${i + 1}`;
      this.messagesMap.set(id, { ...m, id });
    });

    // ===== Calendar events (Maria) =====
    const dayMs = 86400000;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const sampleEvents: Omit<CalendarEvent, "id">[] = [
      { userId: "demo-user-1", disputeId: "dispute-1", title: "FCRA 30-day response deadline", eventType: "fcra_30_day", eventDate: fmt(new Date(now + 22 * dayMs)), status: "pending", colorTag: "red", notes: "Equifax must respond to Midland dispute", createdBy: "admin-user-1", createdAt: new Date(now - 2 * dayMs).toISOString() },
      { userId: "demo-user-1", disputeId: "dispute-1", title: "FCRA 15-day extension deadline", eventType: "fcra_15_day_extension", eventDate: fmt(new Date(now + 37 * dayMs)), status: "pending", colorTag: "gold", notes: "Extended deadline if additional info submitted", createdBy: "admin-user-1", createdAt: new Date(now - 2 * dayMs).toISOString() },
      { userId: "demo-user-1", disputeId: null, title: "Follow-up call with advisor", eventType: "followup", eventDate: fmt(new Date(now + 10 * dayMs)), status: "pending", colorTag: "green", notes: "Review dispute progress", createdBy: "admin-user-1", createdAt: new Date(now - 1 * dayMs).toISOString() },
      { userId: "demo-user-1", disputeId: null, title: "Pay down Chase card below 30%", eventType: "custom", eventDate: fmt(new Date(now + 5 * dayMs)), status: "pending", colorTag: "blue", notes: "Target: under $2,400 balance", createdBy: "demo-user-1", createdAt: new Date(now - 1 * dayMs).toISOString() },
    ];
    sampleEvents.forEach((e, i) => {
      const id = `cal-${i + 1}`;
      this.calendarEvents.set(id, { ...e, id });
    });

    // ===== Documents (Maria) =====
    const sampleDocs: Omit<Document, "id">[] = [
      { userId: "demo-user-1", docType: "3b_report", fileName: "identityiq-3b-report.pdf", fileSize: 512000, status: "uploaded", createdAt: new Date(now - 5 * dayMs).toISOString() },
      { userId: "demo-user-1", docType: "id_license", fileName: "drivers-license.jpg", fileSize: 180000, status: "uploaded", createdAt: new Date(now - 5 * dayMs).toISOString() },
      { userId: "demo-user-1", docType: "utility_bill", fileName: "electric-bill-june.pdf", fileSize: 95000, status: "uploaded", createdAt: new Date(now - 4 * dayMs).toISOString() },
    ];
    sampleDocs.forEach((d, i) => {
      const id = `doc-${i + 1}`;
      this.documents.set(id, { ...d, id });
    });
  }

  // Users
  async getUser(id: string) { return this.users.get(id); }
  async getUserByEmail(email: string) { return Array.from(this.users.values()).find(u => u.email === email); }
  async createUser(u: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...u, id, role: "user", croaDisclosureAcknowledged: false, csoConsent: false, rightToCancelExpiresAt: null, createdAt: new Date().toISOString() };
    this.users.set(id, user);
    return user;
  }
  async updateUser(id: string, data: Partial<User>) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }
  async getAllUsers() { return Array.from(this.users.values()); }

  // Credit Reports
  async getCreditReports(userId: string) {
    return Array.from(this.creditReports.values()).filter(r => r.userId === userId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  async createCreditReport(r: Omit<CreditReport, "id">) {
    const id = randomUUID();
    const report: CreditReport = { ...r, id };
    this.creditReports.set(id, report);
    return report;
  }

  // Tradelines
  async getTradelines(userId: string) { return Array.from(this.tradelinesMap.values()).filter(t => t.userId === userId); }
  async getTradelineById(id: string) { return this.tradelinesMap.get(id); }
  async createTradeline(tl: Omit<Tradeline, "id">) {
    const id = randomUUID();
    const item: Tradeline = { ...tl, id };
    this.tradelinesMap.set(id, item);
    return item;
  }

  // Disputes
  async getDisputes(userId: string) {
    return Array.from(this.disputesMap.values()).filter(d => d.userId === userId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  async createDispute(d: Omit<Dispute, "id">) {
    const id = randomUUID();
    const dispute: Dispute = { ...d, id };
    this.disputesMap.set(id, dispute);
    return dispute;
  }
  async updateDispute(id: string, data: Partial<Dispute>) {
    const d = this.disputesMap.get(id);
    if (!d) return undefined;
    const updated = { ...d, ...data };
    this.disputesMap.set(id, updated);
    return updated;
  }

  // Analyses
  async getAnalyses(userId: string) {
    return Array.from(this.analysesMap.values()).filter(a => a.userId === userId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  async createAnalysis(a: Omit<AIAnalysis, "id">) {
    const id = randomUUID();
    const item: AIAnalysis = { ...a, id };
    this.analysesMap.set(id, item);
    return item;
  }

  // Comparisons
  async getComparisons(userId: string) { return Array.from(this.comparisonsMap.values()).filter(c => c.userId === userId); }
  async createComparison(c: Omit<BureauComparison, "id">) {
    const id = randomUUID();
    const item: BureauComparison = { ...c, id };
    this.comparisonsMap.set(id, item);
    return item;
  }

  // Audit Logs
  async getAuditLogs(limit = 100) {
    return Array.from(this.auditLogsMap.values()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, limit);
  }
  async createAuditLog(log: Omit<AuditLog, "id">) {
    const id = randomUUID();
    const item: AuditLog = { ...log, id };
    this.auditLogsMap.set(id, item);
    return item;
  }

  // Expenses
  async getExpenses(userId: string, scope?: string) {
    return Array.from(this.expenses.values())
      .filter(e => e.userId === userId && (!scope || e.scope === scope))
      .sort((a, b) => (b.occurredOn || "").localeCompare(a.occurredOn || ""));
  }
  async getAllExpenses(scope?: string) {
    return Array.from(this.expenses.values())
      .filter(e => !scope || e.scope === scope)
      .sort((a, b) => (b.occurredOn || "").localeCompare(a.occurredOn || ""));
  }
  async createExpense(e: InsertExpense) {
    const id = randomUUID();
    const item: Expense = {
      id,
      userId: e.userId,
      scope: e.scope ?? "personal",
      category: e.category,
      vendor: e.vendor ?? null,
      amount: e.amount,
      currency: e.currency ?? "USD",
      occurredOn: e.occurredOn,
      paymentMethod: e.paymentMethod ?? null,
      notes: e.notes ?? null,
      receiptUrl: e.receiptUrl ?? null,
      isRecurring: e.isRecurring ?? false,
      createdAt: new Date().toISOString(),
    };
    this.expenses.set(id, item);
    return item;
  }
  async updateExpense(id: string, data: Partial<Expense>) {
    const e = this.expenses.get(id);
    if (!e) return undefined;
    const updated = { ...e, ...data };
    this.expenses.set(id, updated);
    return updated;
  }
  async deleteExpense(id: string) {
    return this.expenses.delete(id);
  }

  // Messages
  async getMessages(clientId: string) {
    return Array.from(this.messagesMap.values())
      .filter(m => m.clientId === clientId)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }
  async getUnreadCount(clientId: string, forRole: string) {
    // Count messages the given role has NOT read — i.e. messages sent by the OTHER role that are unread
    return Array.from(this.messagesMap.values())
      .filter(m => m.clientId === clientId && m.senderRole !== forRole && !m.readAt).length;
  }
  async createMessage(m: Omit<Message, "id">) {
    const id = randomUUID();
    const item: Message = { ...m, id };
    this.messagesMap.set(id, item);
    return item;
  }
  async markMessagesRead(clientId: string, forRole: string) {
    const nowIso = new Date().toISOString();
    for (const m of this.messagesMap.values()) {
      if (m.clientId === clientId && m.senderRole !== forRole && !m.readAt) {
        m.readAt = nowIso;
        this.messagesMap.set(m.id, m);
      }
    }
  }

  // Calendar Events
  async getCalendarEvents(userId: string) {
    return Array.from(this.calendarEvents.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }
  async getAllCalendarEvents() {
    return Array.from(this.calendarEvents.values())
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }
  async createCalendarEvent(e: Omit<CalendarEvent, "id">) {
    const id = randomUUID();
    const item: CalendarEvent = { ...e, id };
    this.calendarEvents.set(id, item);
    return item;
  }
  async updateCalendarEvent(id: string, data: Partial<CalendarEvent>) {
    const e = this.calendarEvents.get(id);
    if (!e) return undefined;
    const updated = { ...e, ...data };
    this.calendarEvents.set(id, updated);
    return updated;
  }
  async deleteCalendarEvent(id: string) {
    return this.calendarEvents.delete(id);
  }
  async generateFcraEventsForDispute(dispute: Dispute) {
    const base = dispute.createdAt ? new Date(dispute.createdAt) : new Date();
    const addDays = (n: number) => {
      const d = new Date(base.getTime() + n * 86400000);
      return d.toISOString().slice(0, 10);
    };
    const events: CalendarEvent[] = [];
    events.push(await this.createCalendarEvent({
      userId: dispute.userId,
      disputeId: dispute.id,
      title: "FCRA 30-day response deadline",
      eventType: "fcra_30_day",
      eventDate: addDays(30),
      status: "pending",
      colorTag: "red",
      notes: dispute.creditorName ? `Response deadline for dispute: ${dispute.creditorName}` : "FCRA 30-day response deadline",
      createdBy: dispute.userId,
      createdAt: new Date().toISOString(),
    }));
    events.push(await this.createCalendarEvent({
      userId: dispute.userId,
      disputeId: dispute.id,
      title: "FCRA 15-day extension deadline",
      eventType: "fcra_15_day_extension",
      eventDate: addDays(45),
      status: "pending",
      colorTag: "gold",
      notes: dispute.creditorName ? `Extension deadline for dispute: ${dispute.creditorName}` : "FCRA 15-day extension deadline",
      createdBy: dispute.userId,
      createdAt: new Date().toISOString(),
    }));
    return events;
  }

  // Documents
  async getDocuments(userId: string) {
    return Array.from(this.documents.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  async createDocument(d: Omit<Document, "id">) {
    const id = randomUUID();
    const item: Document = { ...d, id };
    this.documents.set(id, item);
    return item;
  }
  async deleteDocument(id: string) {
    return this.documents.delete(id);
  }

  // User cascade delete
  async deleteUser(id: string) {
    if (!this.users.has(id)) return false;
    this.users.delete(id);
    for (const [k, v] of this.creditReports) if (v.userId === id) this.creditReports.delete(k);
    for (const [k, v] of this.tradelinesMap) if (v.userId === id) this.tradelinesMap.delete(k);
    for (const [k, v] of this.disputesMap) if (v.userId === id) this.disputesMap.delete(k);
    for (const [k, v] of this.analysesMap) if (v.userId === id) this.analysesMap.delete(k);
    for (const [k, v] of this.comparisonsMap) if (v.userId === id) this.comparisonsMap.delete(k);
    for (const [k, v] of this.expenses) if (v.userId === id) this.expenses.delete(k);
    for (const [k, v] of this.messagesMap) if (v.clientId === id) this.messagesMap.delete(k);
    for (const [k, v] of this.calendarEvents) if (v.userId === id) this.calendarEvents.delete(k);
    for (const [k, v] of this.documents) if (v.userId === id) this.documents.delete(k);
    return true;
  }

  // Stats
  async getStats() {
    return {
      users: this.users.size,
      reports: this.creditReports.size,
      disputes: this.disputesMap.size,
      analyses: this.analysesMap.size,
    };
  }
}

import { DbStorage } from "./db-storage";

export const storage: IStorage = process.env.DATABASE_URL
  ? new DbStorage()
  : new MemStorage();
