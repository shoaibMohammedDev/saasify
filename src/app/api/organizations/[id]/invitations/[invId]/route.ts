import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

// DELETE /api/organizations/[id]/invitations/[invId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  try {
    const { id: orgIdStr, invId: invIdStr } = await params;
    const orgId = parseInt(orgIdStr, 10);
    const invId = parseInt(invIdStr, 10);

    if (isNaN(orgId) || isNaN(invId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    const member = await requireRole(orgId, user.id, ["OWNER", "ADMIN"]);

    if (!canPerform("manage_members", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const invitation = await db.invitation.findFirst({
      where: { id: invId, orgId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    await db.invitation.delete({
      where: { id: invitation.id },
    });

    await logActivity({
      action: "invitation.cancelled",
      description: `${user.name} cancelled the invitation for ${invitation.email}`,
      userId: user.id,
      orgId,
      metadata: { invitationId: invitation.id, email: invitation.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Delete invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}