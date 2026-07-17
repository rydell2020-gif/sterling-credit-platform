import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const DEMO_USER_ID = "demo-user-1";

function resolveUserId(req: Request): string {
  const header = req.header("x-user-id");
  return (header && header.trim()) || DEMO_USER_ID;
}

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
    // Most recent score per bureau (from the newest report of that bureau)
    const scoresByBureau: Record<string, number | null> = {};
    for (const bureau of bureaus) {
      const bureauReports = reports
        .filter(r => r.bureau === bureau)
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      scoresByBureau[bureau] = bureauReports[0]?.rawScore ?? null;
    }
    res.json({
      reportsUploaded: reports.length,
      disputesGenerated: disputes.length,
      issuesDetected: derogatory,
      bureausCovered: bureaus,
      scoresByBureau,
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
    // Auto-populate FCRA compliance calendar deadlines
    try {
      await storage.generateFcraEventsForDispute(dispute);
    } catch (err) {
      console.error("Failed to generate FCRA calendar events:", err);
    }
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

  // ===== Expenses =====
  app.get("/api/expenses", async (req, res) => {
    const userId = resolveUserId(req);
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const expenses = await storage.getExpenses(userId, scope);
    res.json(expenses);
  });

  app.get("/api/admin/expenses", async (req, res) => {
    const scope = typeof req.query.scope === "string" ? req.query.scope : "business";
    const expenses = await storage.getAllExpenses(scope);
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    const userId = req.body.userId || resolveUserId(req);
    const expense = await storage.createExpense({ ...req.body, userId });
    await storage.createAuditLog({
      userId,
      action: "expense_created",
      resource: "expenses",
      resourceId: expense.id,
      metadata: { category: expense.category, amount: expense.amount, scope: expense.scope } as unknown,
      createdAt: new Date().toISOString(),
    });
    res.json(expense);
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    const updated = await storage.updateExpense(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    const ok = await storage.deleteExpense(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ===== Messages =====
  app.get("/api/messages/:clientId", async (req, res) => {
    const messages = await storage.getMessages(req.params.clientId);
    const forRole = typeof req.query.forRole === "string" ? req.query.forRole : "user";
    const unread = await storage.getUnreadCount(req.params.clientId, forRole);
    res.json({ messages, unread });
  });

  app.post("/api/messages", async (req, res) => {
    const message = await storage.createMessage({
      clientId: req.body.clientId,
      senderId: req.body.senderId,
      senderRole: req.body.senderRole,
      body: req.body.body,
      attachmentUrl: req.body.attachmentUrl ?? null,
      attachmentName: req.body.attachmentName ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    res.json(message);
  });

  app.post("/api/messages/:clientId/read", async (req, res) => {
    const forRole = req.body?.forRole || (typeof req.query.forRole === "string" ? req.query.forRole : "user");
    await storage.markMessagesRead(req.params.clientId, forRole);
    res.json({ success: true });
  });

  // ===== Calendar =====
  app.get("/api/calendar", async (req, res) => {
    const userId = resolveUserId(req);
    const events = await storage.getCalendarEvents(userId);
    res.json(events);
  });

  app.get("/api/admin/calendar", async (_req, res) => {
    const events = await storage.getAllCalendarEvents();
    res.json(events);
  });

  app.post("/api/calendar", async (req, res) => {
    const userId = req.body.userId || resolveUserId(req);
    const event = await storage.createCalendarEvent({
      userId,
      disputeId: req.body.disputeId ?? null,
      title: req.body.title,
      eventType: req.body.eventType || "custom",
      eventDate: req.body.eventDate,
      status: req.body.status || "pending",
      colorTag: req.body.colorTag ?? null,
      notes: req.body.notes ?? null,
      createdBy: req.body.createdBy || userId,
      createdAt: new Date().toISOString(),
    });
    res.json(event);
  });

  app.patch("/api/calendar/:id", async (req, res) => {
    const updated = await storage.updateCalendarEvent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/calendar/:id", async (req, res) => {
    const ok = await storage.deleteCalendarEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ===== Documents =====
  app.get("/api/documents", async (req, res) => {
    const userId = resolveUserId(req);
    const docs = await storage.getDocuments(userId);
    res.json(docs);
  });

  app.post("/api/documents", async (req, res) => {
    const userId = req.body.userId || resolveUserId(req);
    const doc = await storage.createDocument({
      userId,
      docType: req.body.docType,
      fileName: req.body.fileName,
      fileSize: req.body.fileSize ?? null,
      status: req.body.status || "uploaded",
      createdAt: new Date().toISOString(),
    });
    await storage.createAuditLog({
      userId,
      action: "document_uploaded",
      resource: "documents",
      resourceId: doc.id,
      metadata: { docType: doc.docType, fileName: doc.fileName } as unknown,
      createdAt: new Date().toISOString(),
    });
    res.json(doc);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const ok = await storage.deleteDocument(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ===== Admin user detail / edit / delete =====
  app.get("/api/admin/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    const [reports, tradelines, disputes, analyses, documents, expenses, calendarEvents] = await Promise.all([
      storage.getCreditReports(user.id),
      storage.getTradelines(user.id),
      storage.getDisputes(user.id),
      storage.getAnalyses(user.id),
      storage.getDocuments(user.id),
      storage.getExpenses(user.id),
      storage.getCalendarEvents(user.id),
    ]);
    res.json({ user, reports, tradelines, disputes, analyses, documents, expenses, calendarEvents });
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ error: "Not found" });
    // Owner cannot be deleted (except by another owner)
    const actorId = req.header("x-user-id") || "";
    const actor = actorId ? await storage.getUser(actorId) : undefined;
    if (target.role === "owner" && actor?.role !== "owner") {
      return res.status(403).json({ error: "Only an owner can remove an owner" });
    }
    const ok = await storage.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ============ Invites ============
  // List all invites (admin/owner)
  app.get("/api/admin/invites", async (_req, res) => {
    const invites = await storage.getInvites();
    res.json(invites);
  });

  // Create a new invite
  app.post("/api/admin/invites", async (req, res) => {
    const { email, fullName, role, message } = req.body as {
      email: string; fullName?: string; role: string; message?: string;
    };
    if (!email || !role) return res.status(400).json({ error: "Email and role are required" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Invalid email" });
    if (!["user", "admin", "owner"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    // Actor identity
    const actorId = req.header("x-user-id") || "";
    const actor = actorId ? await storage.getUser(actorId) : undefined;
    if (!actor) return res.status(401).json({ error: "Not authenticated" });
    // Only owners can invite other owners
    if (role === "owner" && actor.role !== "owner") {
      return res.status(403).json({ error: "Only an owner can invite another owner" });
    }
    // Existing account?
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: "An account already exists for this email" });
    // Generate token (16 bytes hex)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const invite = await storage.createInvite({
      token,
      email,
      fullName: fullName || null,
      role,
      invitedBy: actor.id,
      status: "pending",
      message: message || null,
      acceptedUserId: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),  // 14 days
      acceptedAt: null,
    });
    res.json(invite);
  });

  // Revoke an invite
  app.post("/api/admin/invites/:id/revoke", async (req, res) => {
    const ok = await storage.revokeInvite(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // Look up invite by token (public — for accept page)
  app.get("/api/invites/:token", async (req, res) => {
    const invite = await storage.getInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") {
      return res.status(410).json({ error: `Invite ${invite.status}` });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await storage.updateInvite(invite.id, { status: "expired" });
      return res.status(410).json({ error: "Invite expired" });
    }
    // Only expose safe fields
    res.json({
      token: invite.token,
      email: invite.email,
      fullName: invite.fullName,
      role: invite.role,
      message: invite.message,
      expiresAt: invite.expiresAt,
      status: invite.status,
    });
  });

  // Accept an invite (public)
  app.post("/api/invites/:token/accept", async (req, res) => {
    const { fullName, password } = req.body as { fullName: string; password: string };
    if (!fullName || !password) return res.status(400).json({ error: "Name and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const invite = await storage.getInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") return res.status(410).json({ error: `Invite ${invite.status}` });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await storage.updateInvite(invite.id, { status: "expired" });
      return res.status(410).json({ error: "Invite expired" });
    }
    const existing = await storage.getUserByEmail(invite.email);
    if (existing) return res.status(400).json({ error: "An account already exists for this email" });
    const user = await storage.createUser({ email: invite.email, password, fullName });
    await storage.updateUser(user.id, {
      role: invite.role,
      croaDisclosureAcknowledged: true,
      csoConsent: true,
      rightToCancelExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    await storage.updateInvite(invite.id, {
      status: "accepted",
      acceptedUserId: user.id,
      acceptedAt: new Date().toISOString(),
    });
    const finalUser = await storage.getUser(user.id);
    res.json({
      user: finalUser ? {
        id: finalUser.id, email: finalUser.email, fullName: finalUser.fullName, role: finalUser.role,
      } : null,
    });
  });

  return httpServer;
}
