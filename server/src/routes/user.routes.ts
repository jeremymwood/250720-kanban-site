import { Router, Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRole";
import { validateBody } from "../middleware/validate";

const router = Router();
const prisma = new PrismaClient();

function paramToString(param: string | string[] | undefined): string | null {
  return typeof param === "string" ? param : null;
}

// Extend the request type to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
}

// GET /api/users - List all users (Admin/Developer)
router.get(
  "/",
  authenticateToken,
  authorizeRoles(Role.ADMIN, Role.DEVELOPER),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id - Update user fields (self only; role admin only)
const updateUserSchema = z
  .object({
    username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(255).optional(),
    role: z.nativeEnum(Role).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No updates provided",
  });

const updateUserActiveSchema = z.object({
  active: z.boolean(),
});

router.put(
  "/:id",
  authenticateToken,
  validateBody(updateUserSchema),
  async (req: AuthenticatedRequest, res: Response) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid user id" });
  const { username, name, email, role } = req.body as {
    username?: string;
    name?: string;
    email?: string;
    role?: Role;
  };

  if (req.user?.id !== id && req.user?.role !== Role.ADMIN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const isAdmin = req.user?.role === Role.ADMIN;
    const isSelf = req.user?.id === id;

    if (role && !isAdmin) {
      return res.status(403).json({ error: "Only admins can change roles" });
    }

    const data: { username?: string; name?: string; email?: string; role?: Role } = {};
    if (username) data.username = username.toLowerCase();
    if (name) data.name = name;
    if (email) data.email = email;
    if (role && isAdmin) data.role = role;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid user id" });

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user?.id === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isAdmin = req.user.role === Role.ADMIN;
    const isDeveloperDeletingClient =
      req.user.role === Role.DEVELOPER && targetUser.role === Role.CLIENT;

    if (!isAdmin && !isDeveloperDeletingClient) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const ownedCount = await prisma.project.count({ where: { ownerId: id } });
    if (ownedCount > 0) {
      return res.status(400).json({ error: "User owns projects. Reassign ownership first." });
    }

    await prisma.$transaction([
      prisma.issue.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null },
      }),
      prisma.projectMember.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/users/:id/active - Activate/deactivate user (admin or developer)
router.put(
  "/:id/active",
  authenticateToken,
  authorizeRoles(Role.ADMIN, Role.DEVELOPER),
  validateBody(updateUserActiveSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid user id" });
    const { active } = req.body as { active: boolean };

    if (req.user?.id === id) {
      return res.status(400).json({ error: "Cannot change your own status" });
    }

    try {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (req.user?.role === Role.DEVELOPER && targetUser.role !== Role.CLIENT) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { active },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      });

      res.json(updated);
    } catch (err) {
      console.error("Failed to update user status:", err);
      res.status(500).json({ error: "Failed to update user status" });
    }
  }
);

export default router;
