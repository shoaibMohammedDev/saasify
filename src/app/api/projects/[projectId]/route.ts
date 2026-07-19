import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";
import type { ProjectStatus } from "@prisma/client";

const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or less")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .nullable()
    .optional(),
  teamId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  status: z
    .enum(["ACTIVE", "ARCHIVED"])
    .optional(),
});

// Helper: load project + verify org membership
async function loadProjectAndVerify(
  projectId: number,
  userId: number
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          _count: { select: { members: true } },
        },
      },
      creator: {
        select: { id: true, name: true, email: true, image: true },
      },
      _count: { select: { tasks: true } },
    },
  });

  if (!project) {
    return { error: "Project not found", status: 404 };
  }

  // Verify user is a member of the org that owns this project
  const member = await requireOrgMember(project.orgId, userId);

  return { project, member, orgId: project.orgId };
}

// GET /api/projects/[projectId] — Project detail
export async function GET(
  _request: NextRequest,
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

    const { project } = result;

    // Compute task stats
    const taskStatsRaw = await db.task.groupBy({
      by: ["status"],
      where: { projectId },
      _count: { status: true },
    });

    const taskStats: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    let totalTasks = 0;
    for (const s of taskStatsRaw) {
      taskStats[s.status] = s._count.status;
      totalTasks += s._count.status;
    }

    return NextResponse.json({
      project: {
        ...project,
        taskStats,
        totalTasks,
        taskCompletion:
          totalTasks > 0
            ? Math.round((taskStats.DONE / totalTasks) * 100)
            : 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get project error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[projectId] — Update project
export async function PUT(
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

    if (!canPerform("edit_project", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // At least one field must be provided
    if (
      data.name === undefined &&
      data.description === undefined &&
      data.teamId === undefined &&
      data.status === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Validate teamId belongs to this org
    if (data.teamId !== undefined && data.teamId !== null) {
      const team = await db.team.findFirst({
        where: { id: data.teamId, orgId },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json(
          { error: "Team not found in this organization" },
          { status: 400 }
        );
      }
    }

    const project = await db.project.update({
      where: { id: projectId },
      data,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              take: 5,
              orderBy: { createdAt: "asc" },
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
            _count: { select: { members: true } },
          },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: { select: { tasks: true } },
      },
    });

    // Log activity — especially for status changes
    if (data.status) {
      await db.activityLog.create({
        data: {
          action: "project.status_changed",
          description: `Changed project "${project.name}" status to ${data.status}`,
          userId: user.id,
          orgId,
          projectId,
          metadata: { projectId, newStatus: data.status },
        },
      });
    } else {
      await db.activityLog.create({
        data: {
          action: "project.updated",
          description: `Updated project "${project.name}"`,
          userId: user.id,
          orgId,
          projectId,
          metadata: { projectId, changes: data },
        },
      });
    }

    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Update project error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId] — Delete project
export async function DELETE(
  _request: NextRequest,
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

    const { member, orgId, project } = result;

    if (!canPerform("delete_project", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Delete all tasks first (cascade handles this, but explicit for clarity)
    await db.task.deleteMany({ where: { projectId } });

    // Delete the project
    await db.project.delete({ where: { id: projectId } });

    // Log activity
    await db.activityLog.create({
      data: {
        action: "project.deleted",
        description: `Deleted project "${project.name}"`,
        userId: user.id,
        orgId,
        metadata: { projectId, projectName: project.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}