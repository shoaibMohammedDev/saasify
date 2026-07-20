import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequiredUser, AuthError } from "@/lib/auth-utils";
import { logActivity } from "@/lib/activity";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .optional(),
});

// POST /api/organizations — Create a new organization
export async function POST(request: NextRequest) {
  try {
    const user = await getRequiredUser();
    const body = await request.json();
    const parsed = createOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, slug: providedSlug } = parsed.data;
    const slug = providedSlug || generateSlug(name);

    if (!slug) {
      return NextResponse.json(
        { error: "Could not generate a valid slug from the name" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingSlug = await db.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }

    // Create org + member + activity log in a transaction
    const org = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          ownerId: user.id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          createdAt: true,
        },
      });

      await tx.member.create({
        data: {
          userId: user.id,
          orgId: organization.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
      });

      await logActivity({
        action: "organization.created",
        description: `${user.name} created the organization`,
        userId: user.id,
        orgId: organization.id,
        metadata: { orgName: name, slug },
      }, tx);

      await logActivity({
        action: "member.joined",
        description: `${user.name} created the workspace and joined as Owner`,
        userId: user.id,
        orgId: organization.id,
      }, tx);

      return organization;
    });

    return NextResponse.json(
      { organization: { ...org, role: "OWNER", memberCount: 1, projectCount: 0 } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Create organization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/organizations — List user's organizations
export async function GET() {
  try {
    const user = await getRequiredUser();

    const memberships = await db.member.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const memberCount = await db.member.count({
          where: { orgId: m.org.id },
        });
        const projectCount = await db.project.count({
          where: { orgId: m.org.id },
        });
        return {
          ...m.org,
          role: m.role,
          memberCount,
          projectCount,
        };
      })
    );

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("List organizations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}