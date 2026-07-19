import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequiredUser,
  requireOrgMember,
  requireRole,
  AuthError,
} from "@/lib/auth-utils";
import { canPerform } from "@/lib/permissions";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .optional(),
  logo: z.string().nullable().optional(),
});

// GET /api/organizations/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    const member = await requireOrgMember(orgId, user.id);

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const memberCount = await db.member.count({ where: { orgId } });
    const projectCount = await db.project.count({ where: { orgId } });

    return NextResponse.json({
      organization: {
        ...org,
        role: member.role,
        memberCount,
        projectCount,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Get organization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/organizations/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    const member = await requireRole(orgId, user.id, ["OWNER", "ADMIN"]);

    if (!canPerform("org_settings", member.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, slug, logo } = parsed.data;

    // If slug is being changed, check uniqueness
    if (slug) {
      const existing = await db.organization.findFirst({
        where: { slug, id: { not: orgId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An organization with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logo !== undefined) updateData.logo = logo;

    const updated = await db.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        action: "organization.updated",
        description: `${user.name} updated organization settings`,
        userId: user.id,
        orgId,
        metadata: updateData,
      },
    });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Update organization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const user = await getRequiredUser();
    const member = await requireRole(orgId, user.id, ["OWNER"]);

    if (!canPerform("delete_org", member.role)) {
      return NextResponse.json(
        { error: "Only the owner can delete this organization" },
        { status: 403 }
      );
    }

    // Cascade delete will handle members, projects, tasks, activity_logs, etc.
    await db.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Delete organization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}