import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequiredUser, requireOrgMember, AuthError } from "@/lib/auth-utils";

// GET /api/organizations/[id]/members
// Lists all members of an org with user details, role, joinedAt
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
    const currentMember = await requireOrgMember(orgId, user.id);

    // Parse search query param
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    // Build the where clause for user search
    const userWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const members = await db.member.findMany({
      where: { orgId, user: userWhere },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    // Also fetch pending invitations for this org
    const invitations = await db.invitation.findMany({
      where: {
        orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        invitedBy: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich invitations with inviter name
    const enrichedInvitations = await Promise.all(
      invitations.map(async (inv) => {
        const inviter = await db.user.findUnique({
          where: { id: inv.invitedBy },
          select: { name: true },
        });
        return {
          ...inv,
          inviterName: inviter?.name ?? "Unknown",
        };
      })
    );

    return NextResponse.json({
      members,
      currentUserRole: currentMember.role,
      invitations: enrichedInvitations,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("List members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}