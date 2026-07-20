import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";

// GET /api/organizations/[id]/dashboard
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

    const now = new Date();

    // Run all independent queries in parallel
    const [
      projectCounts,
      taskCounts,
      memberCount,
      taskStatusCounts,
      recentActivity,
      myTasks,
      projectProgress,
    ] = await Promise.all([
      // --- Project counts ---
      db.project.groupBy({
        by: ["status"],
        where: { orgId },
        _count: { status: true },
      }),

      // --- Task counts (total, completed, overdue) ---
      Promise.all([
        db.task.count({
          where: {
            project: { orgId },
          },
        }),
        db.task.count({
          where: {
            project: { orgId },
            status: "DONE",
          },
        }),
        db.task.count({
          where: {
            project: { orgId },
            status: { not: "DONE" },
            dueDate: { lt: now },
          },
        }),
      ]),

      // --- Member count ---
      db.member.count({ where: { orgId } }),

      // --- Task distribution by status ---
      db.task.groupBy({
        by: ["status"],
        where: { project: { orgId } },
        _count: { status: true },
      }),

      // --- Recent activity (last 8) ---
      db.activityLog.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 8,
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

      // --- My tasks (assigned to current user, not DONE, limit 5) ---
      db.task.findMany({
        where: {
          project: { orgId },
          assigneeId: user.id,
          status: { not: "DONE" },
        },
        orderBy: [
          { priority: "desc" },
          { dueDate: { sort: "asc", nulls: "last" } },
        ],
        take: 5,
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      }),

      // --- Project progress (active projects) ---
      db.project.findMany({
        where: { orgId, status: "ACTIVE" },
        select: { id: true, name: true },
      }),
    ]);

    // ---- Derive stats ----
    let totalProjects = 0;
    let activeProjects = 0;
    for (const pc of projectCounts) {
      totalProjects += pc._count.status;
      if (pc.status === "ACTIVE") activeProjects = pc._count.status;
    }

    const [totalTasks, completedTasks, overdueTasks] = taskCounts;

    const taskDistribution = {
      todo: 0,
      inProgress: 0,
      inReview: 0,
      done: 0,
    };
    for (const sc of taskStatusCounts) {
      switch (sc.status) {
        case "TODO":
          taskDistribution.todo = sc._count.status;
          break;
        case "IN_PROGRESS":
          taskDistribution.inProgress = sc._count.status;
          break;
        case "IN_REVIEW":
          taskDistribution.inReview = sc._count.status;
          break;
        case "DONE":
          taskDistribution.done = sc._count.status;
          break;
      }
    }

    // ---- Project progress ----
    const projectIds = projectProgress.map((p) => p.id);
    let projectTaskStats: Array<{
      projectId: number;
      status: string;
      _count: { status: number };
    }> = [];

    if (projectIds.length > 0) {
      projectTaskStats = await db.task.groupBy({
        by: ["projectId", "status"],
        where: { projectId: { in: projectIds } },
        _count: { status: true },
      });
    }

    // Build per-project progress map
    const progressMap = new Map<
      number,
      { total: number; completed: number }
    >();
    for (const pts of projectTaskStats) {
      const existing = progressMap.get(pts.projectId) || {
        total: 0,
        completed: 0,
      };
      existing.total += pts._count.status;
      if (pts.status === "DONE") existing.completed = pts._count.status;
      progressMap.set(pts.projectId, existing);
    }

    const projectProgressData = projectProgress
      .map((p) => {
        const stats = progressMap.get(p.id) || { total: 0, completed: 0 };
        return {
          name: p.name,
          total: stats.total,
          completed: stats.completed,
        };
      })
      .sort((a, b) => {
        if (a.total === 0 && b.total === 0) return 0;
        if (a.total === 0) return 1;
        if (b.total === 0) return -1;
        const rateA = a.completed / a.total;
        const rateB = b.completed / b.total;
        return rateB - rateA;
      })
      .slice(0, 6);

    return NextResponse.json({
      stats: {
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        totalMembers: memberCount,
        overdueTasks,
      },
      taskDistribution,
      recentActivity,
      myTasks,
      projectProgress: projectProgressData,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}