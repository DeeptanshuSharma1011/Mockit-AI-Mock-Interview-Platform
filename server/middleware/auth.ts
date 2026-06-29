import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isUsingMockDB, mockDB, supabase } from "../config/db";

const JWT_SECRET = process.env.JWT_SECRET || "mockit-jwt-secret-key-256";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    name: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is required for this action." });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Access token has expired or is invalid." });
    }

    try {
      if (isUsingMockDB) {
        const found = mockDB.users.find(u => u.id === decoded.userId);
        if (!found) {
          return res.status(401).json({ error: "User session not found in mock workspace storage." });
        }
        req.user = {
          userId: found.id,
          email: found.email,
          name: found.name,
        };
      } else {
        const { data: foundUser, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", decoded.userId)
          .maybeSingle();

        if (error || !foundUser) {
          return res.status(401).json({ error: "User associated with this token no longer exists in Supabase." });
        }
        req.user = {
          userId: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
        };
      }
      next();
    } catch (dbErr) {
      console.error("Auth middleware DB lookup error:", dbErr);
      res.status(500).json({ error: "Internal security verifier lookup error." });
    }
  });
}
