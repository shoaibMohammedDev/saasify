import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(2000, "Comment must be 2000 characters or less"),
});

// Helper: load task + project and verify org membership
async function loadTaskAndVerify(taskId: number, userId: number) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: { id: true, name: true, orgId: true },
      },
    },
  });

  if (!task) {
    return { error: "Task not found", status: 404 };
  }

  const member = await requireOrgMember(task.project.orgId, userId);

  return { task, member, orgId: task.project.orgId, projectId: task.projectId };
}

// POST /api/tasks/[taskId]/comments — Add comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId: taskIdStr } = await params;
    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: "Invalid task ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const result = await loadTaskAndVerify(taskId, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { orgId, projectId } = result;

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const comment = await db.activityLog.create({
      data: {
        action: "task.comment",
        description: parsed.data.content,
        userId: user.id,
        orgId,
        projectId,
        taskId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/[taskId]/comments — List comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId: taskIdStr } = await params;
    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: "Invalid task ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const result = await loadTaskAndVerify(taskId, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    const where = { taskId, action: "task.comment" as const };

    const [comments, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
      db.activityLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      comments,
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
    console.error("List comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}