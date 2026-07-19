import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";

// GET /api/organizations/[id]/members/[userId]
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: orgIdStr, userId: userIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const userId = parseInt(userIdStr, 10);

    if (isNaN(orgId) || isNaN(userId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    await requireRole(orgId, user.id, ["OWNER", "ADMIN", "MEMBER"]);

    const member = await db.member.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/members/[userId]
// Remove a member from the org
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: orgIdStr, userId: userIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const targetUserId = parseInt(userIdStr, 10);

    if (isNaN(orgId) || isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    const member = await requireRole(orgId, user.id, ["OWNER"]);

    if (!canPerform("manage_members", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Cannot remove self
    if (user.id === targetUserId) {
      return NextResponse.json(
        { error: "Cannot remove yourself. Use a different flow to leave the organization." },
        { status: 400 }
      );
    }

    // Find the target member
    const targetMember = await db.member.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot remove other OWNERs
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove an owner. Transfer ownership first." },
        { status: 400 }
      );
    }

    // Get target user name for activity log
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });

    await db.member.delete({
      where: { id: targetMember.id },
    });

    await db.activityLog.create({
      data: {
        action: "member.removed",
        description: `${user.name} removed ${targetUser?.name ?? "a member"} from the organization`,
        userId: user.id,
        orgId,
        metadata: {
          removedUserId: targetUserId,
          removedUserRole: targetMember.role,
        },
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
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}