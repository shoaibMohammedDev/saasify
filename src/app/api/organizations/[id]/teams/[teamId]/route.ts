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

const updateTeamSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(50, "Team name must be 50 characters or less")
    .optional(),
  description: z
    .string()
    .max(200, "Description must be 200 characters or less")
    .optional(),
});

// GET /api/organizations/[id]/teams/[teamId] — Team detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: orgIdStr, teamId: teamIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const teamId = parseInt(teamIdStr, 10);

    if (isNaN(orgId) || isNaN(teamId)) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    await requireOrgMember(orgId, user.id);

    // Get team members with org role
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch org member roles for each team member
    const memberRoles = await db.member.findMany({
      where: {
        orgId,
        userId: { in: teamMembers.map((m) => m.userId) },
      },
      select: { userId: true, role: true },
    });
    const roleMap = new Map(memberRoles.map((r) => [r.userId, r.role]));

    const team = await db.team.findFirst({
      where: { id: teamId, orgId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Enrich members with org role
    const enrichedMembers = teamMembers.map((tm) => ({
      ...tm,
      member: { role: roleMap.get(tm.userId) ?? "MEMBER" },
    }));

    const response = { ...team, members: enrichedMembers };

    return NextResponse.json({ team: response });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/organizations/[id]/teams/[teamId] — Update team
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: orgIdStr, teamId: teamIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const teamId = parseInt(teamIdStr, 10);

    if (isNaN(orgId) || isNaN(teamId)) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const member = await requireOrgMember(orgId, user.id);

    if (!canPerform("manage_teams", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const existing = await db.team.findFirst({
      where: { id: teamId, orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // At least one field must be provided
    if (data.name === undefined && data.description === undefined) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const team = await db.team.update({
      where: { id: teamId },
      data,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: { select: { members: true, projects: true } },
      },
    });

    // Log activity
    await logActivity({
      action: "team.updated",
      description: `Updated team "${existing.name}"`,
      userId: user.id,
      orgId,
      metadata: { teamId, changes: data },
    });

    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Update team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/teams/[teamId] — Delete team
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: orgIdStr, teamId: teamIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const teamId = parseInt(teamIdStr, 10);

    if (isNaN(orgId) || isNaN(teamId)) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 }
      );
    }

    const user = await getRequiredUser();
    const member = await requireOrgMember(orgId, user.id);

    if (!canPerform("manage_teams", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const existing = await db.team.findFirst({
      where: { id: teamId, orgId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Set all project.teamId to null (don't delete projects)
    await db.project.updateMany({
      where: { teamId },
      data: { teamId: null },
    });

    // Delete team members first (cascade handles this, but explicit for clarity)
    await db.teamMember.deleteMany({ where: { teamId } });

    // Delete team
    await db.team.delete({ where: { id: teamId } });

    // Log activity
    await logActivity({
      action: "team.deleted",
      description: `Deleted team "${existing.name}"`,
      userId: user.id,
      orgId,
      metadata: { teamId, teamName: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Delete team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}