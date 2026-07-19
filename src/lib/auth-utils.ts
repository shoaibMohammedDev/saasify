import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "./auth";
import { db } from "./db";
import type { UserRole } from "@prisma/client";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getRequiredUser(request?: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new AuthError("Unauthorized", 401);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    throw new AuthError("User not found", 401);
  }

  return user;
}

export async function requireOrgMember(orgId: number, userId: number) {
  const member = await db.member.findUnique({
    where: {
      userId_orgId: { userId, orgId },
    },
  });

  if (!member) {
    throw new AuthError("Not a member of this organization", 403);
  }

  return member;
}

export async function requireRole(
  orgId: number,
  userId: number,
  roles: UserRole[]
) {
  const member = await requireOrgMember(orgId, userId);

  if (!roles.includes(member.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }

  return member;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AuthError";
  }
}