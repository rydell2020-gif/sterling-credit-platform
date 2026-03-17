import { eq, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  type User, type InsertUser,
  type CreditReport, type Tradeline, type Dispute,
  type AIAnalysis, type BureauComparison, type AuditLog,
  users, creditReports, tradelines, disputes,
  aiAnalyses, bureauComparisons, auditLogs,
} from "@shared/schema";
import type { IStorage } from "./storage";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const rows = await db.insert(users).values(user).returning();
    return rows[0];
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const rows = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return rows[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Credit Reports
  async getCreditReports(userId: string): Promise<CreditReport[]> {
    return db
      .select()
      .from(creditReports)
      .where(eq(creditReports.userId, userId))
      .orderBy(desc(creditReports.createdAt));
  }

  async createCreditReport(report: Omit<CreditReport, "id">): Promise<CreditReport> {
    const rows = await db.insert(creditReports).values(report).returning();
    return rows[0];
  }

  // Tradelines
  async getTradelines(userId: string): Promise<Tradeline[]> {
    return db.select().from(tradelines).where(eq(tradelines.userId, userId));
  }

  async getTradelineById(id: string): Promise<Tradeline | undefined> {
    const rows = await db.select().from(tradelines).where(eq(tradelines.id, id));
    return rows[0];
  }

  async createTradeline(tl: Omit<Tradeline, "id">): Promise<Tradeline> {
    const rows = await db.insert(tradelines).values(tl).returning();
    return rows[0];
  }

  // Disputes
  async getDisputes(userId: string): Promise<Dispute[]> {
    return db
      .select()
      .from(disputes)
      .where(eq(disputes.userId, userId))
      .orderBy(desc(disputes.createdAt));
  }

  async createDispute(d: Omit<Dispute, "id">): Promise<Dispute> {
    const rows = await db.insert(disputes).values(d).returning();
    return rows[0];
  }

  async updateDispute(id: string, data: Partial<Dispute>): Promise<Dispute | undefined> {
    const rows = await db.update(disputes).set(data).where(eq(disputes.id, id)).returning();
    return rows[0];
  }

  // AI Analyses
  async getAnalyses(userId: string): Promise<AIAnalysis[]> {
    return db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.userId, userId))
      .orderBy(desc(aiAnalyses.createdAt));
  }

  async createAnalysis(a: Omit<AIAnalysis, "id">): Promise<AIAnalysis> {
    const rows = await db.insert(aiAnalyses).values(a).returning();
    return rows[0];
  }

  // Bureau Comparisons
  async getComparisons(userId: string): Promise<BureauComparison[]> {
    return db
      .select()
      .from(bureauComparisons)
      .where(eq(bureauComparisons.userId, userId));
  }

  async createComparison(c: Omit<BureauComparison, "id">): Promise<BureauComparison> {
    const rows = await db.insert(bureauComparisons).values(c).returning();
    return rows[0];
  }

  // Audit Logs
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async createAuditLog(log: Omit<AuditLog, "id">): Promise<AuditLog> {
    const rows = await db.insert(auditLogs).values(log).returning();
    return rows[0];
  }

  // Stats
  async getStats(): Promise<{ users: number; reports: number; disputes: number; analyses: number }> {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [reportCount] = await db.select({ count: count() }).from(creditReports);
    const [disputeCount] = await db.select({ count: count() }).from(disputes);
    const [analysisCount] = await db.select({ count: count() }).from(aiAnalyses);

    return {
      users: userCount.count,
      reports: reportCount.count,
      disputes: disputeCount.count,
      analyses: analysisCount.count,
    };
  }
}
