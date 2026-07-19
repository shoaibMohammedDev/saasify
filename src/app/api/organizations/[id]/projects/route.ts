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

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  teamId: z.number().int().positive().optional(),
});

// POST /api/organizations/[id]/projects — Create project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    if (isNaN(orgId)) {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const member = await requireOrgMember(orgId, user.id);

    if (!canPerform("create_project", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, description, teamId } = parsed.data;

    // Validate teamId belongs to this org
    if (teamId) {
      const team = await db.team.findFirst({
        where: { id: teamId, orgId },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json(
          { error: "Team not found in this organization" },
          { status: 400 }
        );
      }
    }

    const project = await db.project.create({
      data: {
        name,
        description,
        status: "ACTIVE",
        orgId,
        teamId: teamId ?? null,
        createdBy: user.id,
      },
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

    // Log activity
    await db.activityLog.create({
      data: {
        action: "project.created",
        description: `Created project "${name}"`,
        userId: user.id,
        orgId,
        projectId: project.id,
        metadata: { projectId: project.id, projectName: name, teamId },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/organizations/[id]/projects — List projects with filtering, search, pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    if (isNaN(orgId)) {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    await requireOrgMember(orgId, user.id);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.toUpperCase() || "ALL";
    const teamIdStr = searchParams.get("teamId");
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { orgId };

    if (status === "ACTIVE" || status === "ARCHIVED") {
      where.status = status as ProjectStatus;
    }

    if (teamIdStr) {
      const teamId = parseInt(teamIdStr, 10);
      if (!isNaN(teamId)) {
        where.teamId = teamId;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
              members: {
                take: 4,
                orderBy: { createdAt: "asc" },
                include: {
                  user: {
                    select: { id: true, name: true, image: true },
                  },
                },
              },
              _count: { select: { members: true } },
            },
          },
          creator: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

    // Get task completion stats for all returned projects
    const projectIds = projects.map((p) => p.id);
    const taskStats =
      projectIds.length > 0
        ? await db.task.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: projectIds } },
            _count: { status: true },
          })
        : [];

    // Build stats map: projectId → { total, done }
    const statsMap = new Map<
      number,
      { total: number; done: number; inProgress: number; todo: number }
    >();
    for (const stat of taskStats) {
      const existing = statsMap.get(stat.projectId) || {
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
      };
      existing.total += stat._count.status;
      if (stat.status === "DONE") existing.done = stat._count.status;
      else if (stat.status === "IN_PROGRESS")
        existing.inProgress = stat._count.status;
      else if (stat.status === "TODO") existing.todo = stat._count.status;
      statsMap.set(stat.projectId, existing);
    }

    // Enrich projects with computed stats
    const enriched = projects.map((p) => {
      const stats = statsMap.get(p.id) || {
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
      };
      return {
        ...p,
        taskStats: stats,
        taskCompletion:
          stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      };
    });

    return NextResponse.json({
      projects: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("List projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}