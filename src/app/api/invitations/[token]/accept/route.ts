import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequiredUser, AuthError } from "@/lib/auth-utils";

// POST /api/invitations/[token]/accept
// Auth required — user must be logged in
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await getRequiredUser();

    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        org: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 410 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 }
      );
    }

    // Check that the logged-in user's email matches the invitation
    if (user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await db.member.findUnique({
      where: {
        userId_orgId: { userId: user.id, orgId: invitation.orgId },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "You are already a member of this organization" },
        { status: 409 }
      );
    }

    // Create the member record and mark invitation as accepted in a transaction
    await db.$transaction(async (tx) => {
      await tx.member.create({
        data: {
          userId: user.id,
          orgId: invitation.orgId,
          role: invitation.role,
          joinedAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await tx.activityLog.create({
        data: {
          action: "invitation.accepted",
          description: `${user.name} accepted the invitation to join`,
          userId: user.id,
          orgId: invitation.orgId,
          metadata: { invitationId: invitation.id, role: invitation.role },
        },
      });
    });

    return NextResponse.json({
      success: true,
      orgId: invitation.org.id,
      orgName: invitation.org.name,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}