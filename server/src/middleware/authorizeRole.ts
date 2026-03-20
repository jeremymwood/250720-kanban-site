import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

// Define the type expected for req.user
type AuthPayload = {
  id: string;
  role: Role;
};

// Extend Express.Request inline with the correct type for user
export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }

    next();
  };
}
