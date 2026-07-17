import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users / Profiles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
  croaDisclosureAcknowledged: boolean("croa_disclosure_acknowledged").default(false),
  csoConsent: boolean("cso_consent").default(false),
  rightToCancelExpiresAt: text("right_to_cancel_expires_at"),
  createdAt: text("created_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  fullName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Credit Reports
export const creditReports = pgTable("credit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  bureau: text("bureau").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("uploaded"),
  rawScore: integer("raw_score"),
  createdAt: text("created_at").default(sql`now()`),
});

export type CreditReport = typeof creditReports.$inferSelect;

// Tradelines
export const tradelines = pgTable("tradelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  reportId: varchar("report_id"),
  creditorName: text("creditor_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountType: text("account_type").notNull(),
  accountStatus: text("account_status").notNull(),
  currentBalance: real("current_balance").default(0),
  creditLimit: real("credit_limit").default(0),
  utilizationPct: real("utilization_pct").default(0),
  paymentStatus: text("payment_status").default("current"),
  accountAgeMonths: integer("account_age_months").default(0),
  riskScore: integer("risk_score").default(0),
  isDerogatory: boolean("is_derogatory").default(false),
  isDisputable: boolean("is_disputable").default(false),
  disputeReason: text("dispute_reason"),
  times30DaysLate: integer("times_30_days_late").default(0),
  times60DaysLate: integer("times_60_days_late").default(0),
  times90DaysLate: integer("times_90_days_late").default(0),
  bureau: text("bureau").notNull(),
});

export type Tradeline = typeof tradelines.$inferSelect;

// Disputes
export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tradelineId: varchar("tradeline_id"),
  bureau: text("bureau").notNull(),
  disputeType: text("dispute_type"),
  letterSubject: text("letter_subject"),
  letterBody: text("letter_body"),
  creditorName: text("creditor_name"),
  status: text("status").notNull().default("draft"),
  disclaimerAcknowledged: boolean("disclaimer_acknowledged").default(false),
  createdAt: text("created_at").default(sql`now()`),
});

export type Dispute = typeof disputes.$inferSelect;

// AI Analyses
export const aiAnalyses = pgTable("ai_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  recommendations: jsonb("recommendations"),
  priorityActions: jsonb("priority_actions"),
  riskAssessment: jsonb("risk_assessment"),
  createdAt: text("created_at").default(sql`now()`),
});

export type AIAnalysis = typeof aiAnalyses.$inferSelect;

// Bureau Comparisons
export const bureauComparisons = pgTable("bureau_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  discrepancyType: text("discrepancy_type").notNull(),
  creditorName: text("creditor_name").notNull(),
  accountNumber: text("account_number"),
  bureausAffected: jsonb("bureaus_affected"),
  details: jsonb("details"),
  severity: text("severity").default("low"),
  isDisputable: boolean("is_disputable").default(false),
});

export type BureauComparison = typeof bureauComparisons.$inferSelect;

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: varchar("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: text("created_at").default(sql`now()`),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// Expenses — for both client personal expenses and admin business expenses
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),  // owner
  scope: text("scope").notNull().default("personal"),  // "personal" | "business"
  category: text("category").notNull(),  // rent, utilities, credit_card, food, transport, insurance, subscription, ads, software, mileage, client_fee, other
  vendor: text("vendor"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  occurredOn: text("occurred_on").notNull(),  // YYYY-MM-DD
  paymentMethod: text("payment_method"),  // cash, debit, credit, ach, check
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  isRecurring: boolean("is_recurring").default(false),
  createdAt: text("created_at").default(sql`now()`),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Messages — chat threads between admin and client (one per client)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),  // "admin" | "user"
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  readAt: text("read_at"),
  createdAt: text("created_at").default(sql`now()`),
});

export type Message = typeof messages.$inferSelect;

// Calendar events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  disputeId: varchar("dispute_id"),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),  // "fcra_30_day" | "fcra_15_day_extension" | "custom" | "followup"
  eventDate: text("event_date").notNull(),  // YYYY-MM-DD
  status: text("status").notNull().default("pending"),
  colorTag: text("color_tag"),  // gold, red, green, blue
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: text("created_at").default(sql`now()`),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Documents (beyond credit reports)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  docType: text("doc_type").notNull(),  // "3b_report" | "4k_report" | "id_license" | "utility_bill" | "other"
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("uploaded"),
  createdAt: text("created_at").default(sql`now()`),
});

export type Document = typeof documents.$inferSelect;
