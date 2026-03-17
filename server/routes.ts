import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth — simplified (no real auth, uses demo user for demo)
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, fullName } = req.body;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: "Email already registered" });
    const user = await storage.createUser({ email, password, fullName });
    await storage.updateUser(user.id, {
      croaDisclosureAcknowledged: true,
      csoConsent: true,
      rightToCancelExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  });

  // Demo login (auto-login as demo user)
  app.get("/api/auth/demo", async (_req, res) => {
    const user = await storage.getUser("demo-user-1");
    if (!user) return res.status(404).json({ error: "Demo user not found" });
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  });

  // User profile
  app.get("/api/user/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  });

  // Dashboard stats
  app.get("/api/dashboard/:userId", async (req, res) => {
    const userId = req.params.userId;
    const [reports, tradelines, disputes] = await Promise.all([
      storage.getCreditReports(userId),
      storage.getTradelines(userId),
      storage.getDisputes(userId),
    ]);
    const bureaus = [...new Set(reports.map(r => r.bureau))];
    const derogatory = tradelines.filter(t => t.isDerogatory).length;
    res.json({
      reportsUploaded: reports.length,
      disputesGenerated: disputes.length,
      issuesDetected: derogatory,
      bureausCovered: bureaus,
      recentReports: reports.slice(0, 5),
    });
  });

  // Credit Reports
  app.get("/api/reports/:userId", async (req, res) => {
    const reports = await storage.getCreditReports(req.params.userId);
    res.json(reports);
  });

  app.post("/api/reports", async (req, res) => {
    const report = await storage.createCreditReport({
      ...req.body,
      status: "uploaded",
      createdAt: new Date().toISOString(),
    });
    await storage.createAuditLog({
      userId: req.body.userId,
      action: "upload",
      resource: "credit_reports",
      resourceId: report.id,
      metadata: { bureau: req.body.bureau } as unknown,
      createdAt: new Date().toISOString(),
    });
    res.json(report);
  });

  // Tradelines
  app.get("/api/tradelines/:userId", async (req, res) => {
    const tradelines = await storage.getTradelines(req.params.userId);
    res.json(tradelines);
  });

  // AI Analysis
  app.get("/api/analysis/:userId", async (req, res) => {
    const analyses = await storage.getAnalyses(req.params.userId);
    if (analyses.length > 0) {
      res.json(analyses[0]);
    } else {
      res.json(null);
    }
  });

  app.post("/api/analysis/:userId/run", async (req, res) => {
    const userId = req.params.userId;
    // Return existing or generate mock analysis
    const existing = await storage.getAnalyses(userId);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    const analysis = await storage.createAnalysis({
      userId,
      recommendations: [] as unknown,
      priorityActions: [] as unknown,
      riskAssessment: {} as unknown,
      createdAt: new Date().toISOString(),
    });
    res.json(analysis);
  });

  // Disputes
  app.get("/api/disputes/:userId", async (req, res) => {
    const disputes = await storage.getDisputes(req.params.userId);
    res.json(disputes);
  });

  app.post("/api/disputes", async (req, res) => {
    const dispute = await storage.createDispute({
      ...req.body,
      status: "draft",
      disclaimerAcknowledged: false,
      createdAt: new Date().toISOString(),
    });
    await storage.createAuditLog({
      userId: req.body.userId,
      action: "dispute_generated",
      resource: "disputes",
      resourceId: dispute.id,
      metadata: { bureau: req.body.bureau } as unknown,
      createdAt: new Date().toISOString(),
    });
    res.json(dispute);
  });

  app.patch("/api/disputes/:id", async (req, res) => {
    const updated = await storage.updateDispute(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Bureau Comparisons
  app.get("/api/comparisons/:userId", async (req, res) => {
    const comps = await storage.getComparisons(req.params.userId);
    res.json(comps);
  });

  // Admin
  app.get("/api/admin/users", async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/audit-logs", async (_req, res) => {
    const logs = await storage.getAuditLogs(100);
    res.json(logs);
  });

  app.get("/api/admin/stats", async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  return httpServer;
}
