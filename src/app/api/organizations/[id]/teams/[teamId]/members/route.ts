import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const addMemberSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
});

// POST /api/organizations/[id]/teams/[teamId]/members — Add member to team
export async function POST(
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

    // Verify team belongs to this org
    const team = await db.team.findFirst({
      where: { id: teamId, orgId },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { userId } = parsed.data;

    // Check target user is an org member
    const targetMember = await db.member.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 400 }
      );
    }

    // Check not already in team
    const existing = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 409 }
      );
    }

    // Add to team
    await db.teamMember.create({
      data: { teamId, userId },
    });

    // Get user name for activity log
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Log activity
    await logActivity({
      action: "team.member_added",
      description: `Added ${targetUser?.name ?? "a member"} to team "${team.name}"`,
      userId: user.id,
      orgId,
      metadata: { teamId, addedUserId: userId, teamName: team.name },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Add team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}