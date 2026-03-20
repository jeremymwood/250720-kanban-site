// server/src/routes/project.routes.ts
import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRole";
import { Role } from "@prisma/client";
import { z } from "zod";
import { validateBody } from "../middleware/validate";

const router = Router();

function paramToString(param: string | string[] | undefined): string | null {
  return typeof param === "string" ? param : null;
}

// GET /api/projects
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const projects = await prisma.project.findMany({
      include: {
        issues: {
          include: {
            assignee: true,
          },
        },
        owner: true,
      },
    });

    res.json(projects);
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects
const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "No updates provided",
  });

const updateProjectOwnerSchema = z.object({
  ownerId: z.string().uuid().nullable(),
});

router.post(
  "/",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  validateBody(createProjectSchema),
  async (req: Request, res: Response) => {
  const { name, description, ownerId } = req.body;

  try {
    const data: any = {
      name,
      description,
    };

    if (ownerId) {
      data.owner = { connect: { id: ownerId } };
    }

    const project = await prisma.project.create({
      data,
      include: { owner: true },
    });
    
    res.status(201).json(project);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// PUT /api/projects/:id
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  validateBody(updateProjectSchema),
  async (req: Request, res: Response) => {
  try {
    const id = paramToString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid project id" });
    const { name, description } = req.body;

    const updated = await prisma.project.update({
      where: { id },
      data: { name, description },
    });

    res.json(updated);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// PUT /api/projects/:id/owner
router.put(
  "/:id/owner",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  validateBody(updateProjectOwnerSchema),
  async (req: Request, res: Response) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid project id" });
  const { ownerId } = req.body;

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Error updating project owner:", err);
    res.status(500).json({ error: "Failed to update owner" });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", authenticateToken, authorizeRoles(Role.ADMIN), async (req, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid project id" });

  try {
    await prisma.project.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
