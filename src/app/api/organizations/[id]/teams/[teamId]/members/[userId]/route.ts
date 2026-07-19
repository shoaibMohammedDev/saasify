import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";

// DELETE /api/organizations/[id]/teams/[teamId]/members/[userId] — Remove member from team
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string; userId: string }> }
) {
  try {
    const { id: orgIdStr, teamId: teamIdStr, userId: userIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const teamId = parseInt(teamIdStr, 10);
    const userId = parseInt(userIdStr, 10);

    if (isNaN(orgId) || isNaN(teamId) || isNaN(userId)) {
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

    // Check the target is actually in the team
    const teamMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "User is not a member of this team" },
        { status: 404 }
      );
    }

    // Remove from team
    await db.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    // Get user name for activity log
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: "team.member_removed",
        description: `Removed ${targetUser?.name ?? "a member"} from team "${team.name}"`,
        userId: user.id,
        orgId,
        metadata: { teamId, removedUserId: userId, teamName: team.name },
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
    console.error("Remove team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}