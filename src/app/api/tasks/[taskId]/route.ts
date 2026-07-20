import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
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

// Helper: load task + project and verify org membership
async function loadTaskAndVerify(taskId: number, userId: number) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
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

// GET /api/tasks/[taskId] — Task detail
export async function GET(
  _request: NextRequest,
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

    // Load task with full relations
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, name: true, orgId: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Verify org membership
    await requireOrgMember(task.project.orgId, user.id);

    // Fetch comments (activity logs with action="task.comment")
    const comments = await db.activityLog.findMany({
      where: { taskId, action: "task.comment" },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({
      task: {
        ...task,
        project: {
          id: task.project.id,
          name: task.project.name,
        },
      },
      comments,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[taskId] — Update task
export async function PUT(
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

    const { task, member, orgId, projectId } = result;

    // RBAC: OWNER/ADMIN can edit any task
    // MEMBER can only edit tasks assigned to them OR change status of tasks assigned to them
    const isOwnerOrAdmin = canPerform("edit_any_task", member.role);
    const isAssignee = task.assigneeId === user.id;

    if (!isOwnerOrAdmin) {
      if (!isAssignee) {
        return NextResponse.json(
          { error: "You can only edit tasks assigned to you" },
          { status: 403 }
        );
      }
      // MEMBER who is the assignee can edit — allowed
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // At least one field must be provided
    if (
      data.title === undefined &&
      data.description === undefined &&
      data.status === undefined &&
      data.priority === undefined &&
      data.assigneeId === undefined &&
      data.dueDate === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Validate assigneeId is an org member if provided
    if (data.assigneeId !== undefined && data.assigneeId !== null) {
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

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Log specific activity for status change
    if (data.status && data.status !== task.status) {
      await logActivity({
        action: "task.status_changed",
        description: `Changed task "${task.title}" status from ${task.status} to ${data.status}`,
        userId: user.id,
        orgId,
        projectId,
        taskId,
        metadata: { oldStatus: task.status, newStatus: data.status },
      });
    }

    // Log specific activity for priority change
    if (data.priority && data.priority !== task.priority) {
      await logActivity({
        action: "task.priority_changed",
        description: `Changed task "${task.title}" priority from ${task.priority} to ${data.priority}`,
        userId: user.id,
        orgId,
        projectId,
        taskId,
        metadata: { oldPriority: task.priority, newPriority: data.priority },
      });
    }

    // Log specific activity for assignee change
    if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
      let assigneeName: string | null = null;
      if (data.assigneeId) {
        const assignee = await db.user.findUnique({
          where: { id: data.assigneeId },
          select: { name: true },
        });
        assigneeName = assignee?.name ?? null;
      }
      await logActivity({
        action: "task.assigned",
        description: assigneeName
          ? `Assigned task "${task.title}" to ${assigneeName}`
          : `Unassigned task "${task.title}"`,
        userId: user.id,
        orgId,
        projectId,
        taskId,
        metadata: { assigneeId: data.assigneeId, assigneeName },
      });
    }

    // If there were changes but none of the specific ones above triggered a log
    if (
      !data.status &&
      !data.priority &&
      data.assigneeId === undefined
    ) {
      await logActivity({
        action: "task.updated",
        description: `Updated task "${task.title}"`,
        userId: user.id,
        orgId,
        projectId,
        taskId,
        metadata: { taskId, changes: data },
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Update task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId] — Delete task
export async function DELETE(
  _request: NextRequest,
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

    const { task, orgId, projectId } = result;

    // Require OWNER or ADMIN
    await requireRole(orgId, user.id, ["OWNER", "ADMIN"]);

    // Log activity before deletion (cascade handles activity logs tied to task)
    await logActivity({
      action: "task.deleted",
      description: `Deleted task "${task.title}"`,
      userId: user.id,
      orgId,
      projectId,
      taskId,
      metadata: { taskId, title: task.title },
    });

    // Delete task (cascade handles related activity logs)
    await db.task.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Delete task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}