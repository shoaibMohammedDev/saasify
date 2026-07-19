import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";

const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

// PUT /api/organizations/[id]/members/[userId]/role
// Change a member's role (OWNER only, cannot change own role or other OWNERs)
export async function PUT(
  request: NextRequest,
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

    if (!canPerform("change_roles", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = changeRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { role: newRole } = parsed.data;

    // Cannot change own role
    if (user.id === targetUserId) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
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

    // Cannot change other OWNER's role
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change the role of an owner. Transfer ownership first." },
        { status: 400 }
      );
    }

    // No-op if same role
    if (targetMember.role === newRole) {
      return NextResponse.json(
        { error: "Member already has this role" },
        { status: 400 }
      );
    }

    const updated = await db.member.update({
      where: { id: targetMember.id },
      data: { role: newRole },
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

    await db.activityLog.create({
      data: {
        action: "member.role_changed",
        description: `${user.name} changed ${updated.user.name}'s role from ${targetMember.role} to ${newRole}`,
        userId: user.id,
        orgId,
        metadata: {
          targetUserId,
          previousRole: targetMember.role,
          newRole,
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Change role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}