// server/src/routes/issue.routes.ts
import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRole";
import { IssuePriority, IssueStatus, Role } from "@prisma/client";
import { z } from "zod";
import { validateBody } from "../middleware/validate";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
}

function paramToString(param: string | string[] | undefined): string | null {
  return typeof param === "string" ? param : null;
}

// Get all issues for a specific project
router.get("/project/:projectId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const projectId = paramToString(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: "Invalid project id" });

    const issues = await prisma.issue.findMany({
      where: { projectId },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.json(issues);
  } catch (err) {
    console.error("Error fetching issues:", err);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

// PUT /api/issues/:id - Update issue title/description
const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "Missing fields: title or description",
  });

const updateIssueAssigneeSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

const updateIssueStatusSchema = z.object({
  status: z.nativeEnum(IssueStatus),
});

const updateIssuePrioritySchema = z.object({
  priority: z.nativeEnum(IssuePriority),
});

const createIssueSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(IssueStatus).optional(),
  priority: z.nativeEnum(IssuePriority).optional(),
});

router.put("/:id", authenticateToken, validateBody(updateIssueSchema), async (req: AuthenticatedRequest, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid issue id" });
  const { title, description } = req.body;

  if (title === undefined && description === undefined) {
    return res.status(400).json({ error: "Missing fields: title or description" });
  }

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.role !== Role.ADMIN) {
      if (req.user.role !== Role.DEVELOPER) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { assigneeId: true },
      });

      if (!issue || issue.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update issue:", err);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

// PUT /api/issues/:id/assignee - Update issue assignee
router.put(
  "/:id/assignee",
  authenticateToken,
  validateBody(updateIssueAssigneeSchema),
  async (req: AuthenticatedRequest, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid issue id" });
  const { assigneeId } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.role !== Role.ADMIN) {
      if (req.user.role !== Role.DEVELOPER) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { assigneeId: true },
      });

      if (!issue || issue.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { assigneeId },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update assignee:", err);
    res.status(500).json({ error: "Failed to update assignee" });
  }
});

// PUT /api/issues/:id/status
router.put(
  "/:id/status",
  authenticateToken,
  validateBody(updateIssueStatusSchema),
  async (req: AuthenticatedRequest, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid issue id" });
  const { status } = req.body as { status: IssueStatus };

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.role !== Role.ADMIN) {
      if (req.user.role !== Role.DEVELOPER) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { assigneeId: true },
      });

      if (!issue || issue.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { status: status as IssueStatus },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update issue status:", err);
    res.status(500).json({ error: "Failed to update issue status" });
  }
});

// PUT /api/priority/:id/priority
router.put(
  "/:id/priority",
  authenticateToken,
  validateBody(updateIssuePrioritySchema),
  async (req: AuthenticatedRequest, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid issue id" });
  const { priority } = req.body as { priority: IssuePriority };

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (
      req.user.role !== Role.ADMIN &&
      req.user.role !== Role.CLIENT &&
      req.user.role !== Role.DEVELOPER
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        project: { include: { members: true } },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    if (req.user.role === Role.DEVELOPER && issue.assigneeId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.user.role === Role.CLIENT) {
      const isOwner = issue.project.ownerId === req.user.id;
      const isMember = issue.project.members.some((m) => m.userId === req.user?.id);
      const isAssignee = issue.assigneeId === req.user.id;
      if (!isOwner && !isMember && !isAssignee) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { priority: priority as IssuePriority },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Failed to update issue priority:", err);
    res.status(500).json({ error: "Failed to update issue priority" });
  }
});

// POST /api/issues - Create a new issue
router.post(
  "/",
  authenticateToken,
  authorizeRoles(Role.ADMIN, Role.DEVELOPER),
  validateBody(createIssueSchema),
  async (req: Request, res: Response) => {
  const { title, description, projectId, assigneeId, status, priority } = req.body;

  try {
    const newIssue = await prisma.issue.create({
      data: {
        title,
        description,
        project: { connect: { id: projectId } },
        assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
        status: status as IssueStatus || IssueStatus.NEW,
        priority: priority as IssuePriority || IssuePriority.LOW
      },
      include: {
        assignee: true,
        project: true,
      },
    });

    res.status(201).json(newIssue);
  } catch (err) {
    console.error("Error creating issue:", err);
    res.status(500).json({ error: "Failed to create issue" });
  }
});

router.delete("/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const id = paramToString(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid issue id" });

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.role !== Role.ADMIN) {
      if (req.user.role !== Role.DEVELOPER) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { assigneeId: true },
      });

      if (!issue || issue.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    await prisma.issue.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete issue error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
