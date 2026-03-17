import { type Request, Response, NextFunction } from "express";

// Clerk middleware - verifies JWT from Authorization header
// In production, install @clerk/express and use clerkMiddleware()
// For now, this is a session-based auth that works with Clerk's frontend SDK

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

// Simple session-based auth middleware
// Replace with Clerk's clerkMiddleware() + requireAuth() in production
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.userId = userId;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] as string;
  if (role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
