import { db } from "./db";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Activity Action Taxonomy
// ---------------------------------------------------------------------------
//
// organization.created, organization.updated, organization.deleted
// member.joined, member.role_changed, member.removed
// invitation.created, invitation.accepted, invitation.cancelled
// team.created, team.updated, team.deleted, team.member_added, team.member_removed
// project.created, project.updated, project.status_changed, project.archived, project.deleted
// task.created, task.updated, task.status_changed, task.deleted, task.comment, task.assigned
// task.priority_changed
// ---------------------------------------------------------------------------

export interface LogActivityParams {
  action: string;
  description: string;
  userId: number;
  orgId: number;
  projectId?: number;
  taskId?: number;
  metadata?: Record<string, unknown>;
}

type DbClient = Prisma.TransactionClient | typeof db;

/**
 * Create an ActivityLog record. Safe to call from any API route.
 * Fails silently so that a logging failure never breaks a mutation.
 */
export async function logActivity(
  params: LogActivityParams,
  tx?: DbClient
): Promise<void> {
  try {
    const client = tx ?? db;
    await client.activityLog.create({
      data: {
        action: params.action,
        description: params.description,
        userId: params.userId,
        orgId: params.orgId,
        projectId: params.projectId ?? null,
        taskId: params.taskId ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (error) {
    // Logging should never break a business operation.
    console.error("[logActivity] Failed to create activity log:", error);
  }
}