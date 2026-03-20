// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Role } from "@prisma/client";

// Define the shape of the decoded token payload
interface AuthenticatedUser extends JwtPayload {
  id: string;
  role: Role;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied, no token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      console.error("JWT verification failed:", err);
      return res.status(403).json({ error: "Invalid token" });
    }

    const user = decoded as AuthenticatedUser;

    if (!user.id || !user.role) {
      return res.status(403).json({ error: "Invalid token payload" });
    }

    (req as any).user = user;

    next();
  });
};
