import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";

// GET /api/organizations/[id]/members/available?teamId=X
// Returns org members NOT already in a specific team
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
    await requireRole(orgId, user.id, ["OWNER", "ADMIN"]);

    // Parse teamId query param
    const { searchParams } = new URL(request.url);
    const teamIdStr = searchParams.get("teamId");
    const teamId = teamIdStr ? parseInt(teamIdStr, 10) : null;

    if (!teamId || isNaN(teamId)) {
      return NextResponse.json(
        { error: "teamId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify team belongs to this org
    const team = await db.team.findFirst({
      where: { id: teamId, orgId },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found in this organization" },
        { status: 404 }
      );
    }

    // Get user IDs already in this team
    const existingTeamMembers = await db.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingTeamMembers.map((m) => m.userId));

    // Get all org members not in this team
    const availableMembers = await db.member.findMany({
      where: {
        orgId,
        userId: { notIn: Array.from(existingUserIds) },
      },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json({ members: availableMembers });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Available members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}