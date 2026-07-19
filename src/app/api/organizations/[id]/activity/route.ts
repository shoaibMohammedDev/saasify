import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";

// Category → Prisma filter mapping for frontend action filter dropdown
const ACTION_CATEGORY_FILTERS: Record<string, Prisma.ActivityLogWhereInput["action"]> = {
  created: { contains: ".created" },
  updated: { in: ["organization.updated", "team.updated", "project.updated", "task.updated", "project.status_changed", "task.status_changed", "task.priority_changed"] },
  deleted: { in: ["organization.deleted", "team.deleted", "project.deleted", "task.deleted", "member.removed", "team.member_removed", "invitation.cancelled"] },
  comments: "task.comment",
  assignments: "task.assigned",
};

// GET /api/organizations/[id]/activity
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

    // ---- Query params ----
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    // ---- Build where clause ----
    const where: Record<string, unknown> = { orgId };

    if (projectId) {
      where.projectId = parseInt(projectId, 10);
    }
    if (userId) {
      where.userId = parseInt(userId, 10);
    }
    if (action && action !== "all") {
      // Support category-based filtering (created, updated, deleted, comments, assignments)
      // as well as exact action strings (e.g. "task.created")
      const categoryFilter = ACTION_CATEGORY_FILTERS[action];
      if (categoryFilter) {
        where.action = categoryFilter;
      } else {
        where.action = action;
      }
    }

    // ---- Fetch ----
    const [activities, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          project: {
            select: { id: true, name: true },
          },
          task: {
            select: { id: true, title: true, status: true },
          },
        },
      }),
      db.activityLog.count({ where }),
    ]);

    const hasMore = page * limit < total;

    return NextResponse.json({
      activities,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}