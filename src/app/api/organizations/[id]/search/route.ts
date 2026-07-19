import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  AuthError,
} from "@/lib/auth-utils";

// GET /api/organizations/[id]/search?q=...
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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json({
        projects: [],
        tasks: [],
        teams: [],
        members: [],
      });
    }

    const searchFilter = {
      contains: q,
      mode: "insensitive" as const,
    };

    // Run all 4 searches in parallel (max 5 per group)
    const [projects, tasks, teams, members] = await Promise.all([
      // Projects: search name + description
      db.project.findMany({
        where: {
          orgId,
          OR: [{ name: searchFilter }, { description: searchFilter }],
        },
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { tasks: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),

      // Tasks: search title + description
      db.task.findMany({
        where: {
          project: { orgId },
          OR: [{ title: searchFilter }, { description: searchFilter }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          project: { select: { id: true, name: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),

      // Teams: search name
      db.team.findMany({
        where: {
          orgId,
          name: searchFilter,
        },
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      // Members: search user name + email
      db.member.findMany({
        where: {
          orgId,
          OR: [
            { user: { name: searchFilter } },
            { user: { email: searchFilter } },
          ],
        },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        take: 5,
        orderBy: { joinedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        taskCount: p._count.tasks,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectId: t.project.id,
        projectName: t.project.name,
      })),
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t._count.members,
      })),
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}