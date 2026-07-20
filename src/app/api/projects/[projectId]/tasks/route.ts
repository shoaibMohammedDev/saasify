import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .nullable()
    .optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: z.string().min(1).nullable().optional(),
});

// Helper: load project and verify org membership
async function loadProjectAndVerify(projectId: number, userId: number) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      orgId: true,
    },
  });

  if (!project) {
    return { error: "Project not found", status: 404 };
  }

  const member = await requireOrgMember(project.orgId, userId);

  return { project, member, orgId: project.orgId };
}

// POST /api/projects/[projectId]/tasks — Create task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const result = await loadProjectAndVerify(projectId, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { member, orgId } = result;

    if (!canPerform("create_task", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate assigneeId is an org member if provided
    if (data.assigneeId) {
      const assigneeMember = await db.member.findUnique({
        where: {
          userId_orgId: { userId: data.assigneeId, orgId },
        },
      });
      if (!assigneeMember) {
        return NextResponse.json(
          { error: "Assignee is not a member of this organization" },
          { status: 400 }
        );
      }
    }

    const task = await db.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "TODO",
        priority: data.priority ?? "MEDIUM",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId,
        assigneeId: data.assigneeId ?? null,
        createdBy: user.id,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Log activity
    await logActivity({
      action: "task.created",
      description: `Created task "${task.title}"`,
      userId: user.id,
      orgId,
      projectId,
      taskId: task.id,
      metadata: { taskId: task.id, title: task.title },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/projects/[projectId]/tasks — List tasks with filtering and pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const result = await loadProjectAndVerify(projectId, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // Validate sort fields
    const validSortFields = ["createdAt", "priority", "dueDate", "title"];
    const validSortDirs = ["asc", "desc"];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: "Invalid sortBy field" },
        { status: 400 }
      );
    }
    if (!validSortDirs.includes(sortDir)) {
      return NextResponse.json(
        { error: "Invalid sortDir" },
        { status: 400 }
      );
    }

    // Build where filter
    const where: Record<string, unknown> = { projectId };

    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (assigneeId) {
      where.assigneeId = parseInt(assigneeId, 10);
    }
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    // Priority order mapping for sorting
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        orderBy:
          sortBy === "priority"
            ? { createdAt: sortDir === "asc" ? "asc" : "desc" }
            : { [sortBy]: sortDir === "asc" ? "asc" : "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
          creator: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
      db.task.count({ where }),
    ]);

    // Sort by priority in-memory if needed (since Prisma can't sort by enum ordinal)
    let sortedTasks = tasks;
    if (sortBy === "priority") {
      sortedTasks = [...tasks].sort((a, b) => {
        const diff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        return sortDir === "asc" ? diff : -diff;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      tasks: sortedTasks,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("List tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}