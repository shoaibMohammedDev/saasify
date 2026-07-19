// ---------------------------------------------------------------------------
// Human-readable description generators for activity actions
// ---------------------------------------------------------------------------

interface DescriptionContext {
  userName: string;
  projectName?: string;
  taskTitle?: string;
  teamName?: string;
  orgName?: string;
  targetUserName?: string;
  /** Extra info from metadata (e.g. old/new status) */
  metadata?: Record<string, unknown>;
}

/** Display-friendly labels for enum-style values */
const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

function label(val: unknown): string {
  if (typeof val === "string") return statusLabels[val] ?? val;
  return String(val);
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateActivityDescription(
  action: string,
  ctx: DescriptionContext
): string {
  const { userName } = ctx;

  switch (action) {
    // ---- Organization ----
    case "organization.created":
      return `${userName} created the organization "${ctx.orgName ?? "this workspace"}"`;
    case "organization.updated":
      return `${userName} updated the organization settings`;
    case "organization.deleted":
      return `${userName} deleted the organization "${ctx.orgName ?? "this workspace"}"`;

    // ---- Members ----
    case "member.joined":
      return `${userName} joined the workspace`;
    case "member.role_changed": {
      const from = label(ctx.metadata?.oldRole);
      const to = label(ctx.metadata?.newRole);
      return `${userName} changed ${ctx.targetUserName ?? "a member"}'s role from ${from} to ${to}`;
    }
    case "member.removed":
      return `${userName} removed ${ctx.targetUserName ?? "a member"} from the workspace`;

    // ---- Invitations ----
    case "invitation.created":
      return `${userName} invited a new member`;
    case "invitation.accepted":
      return `${userName} accepted the invitation`;
    case "invitation.cancelled":
      return `${userName} cancelled an invitation`;

    // ---- Teams ----
    case "team.created":
      return `${userName} created team "${ctx.teamName ?? "Untitled"}"`;
    case "team.updated":
      return `${userName} updated team "${ctx.teamName ?? "Untitled"}"`;
    case "team.deleted":
      return `${userName} deleted team "${ctx.teamName ?? "Untitled"}"`;
    case "team.member_added":
      return `${userName} added ${ctx.targetUserName ?? "a member"} to team "${ctx.teamName ?? "Untitled"}"`;
    case "team.member_removed":
      return `${userName} removed ${ctx.targetUserName ?? "a member"} from team "${ctx.teamName ?? "Untitled"}"`;

    // ---- Projects ----
    case "project.created":
      return `${userName} created project "${ctx.projectName ?? "Untitled"}"`;
    case "project.updated":
      return `${userName} updated project "${ctx.projectName ?? "Untitled"}"`;
    case "project.status_changed": {
      const from = label(ctx.metadata?.oldStatus);
      const to = label(ctx.metadata?.newStatus);
      return `${userName} changed project "${ctx.projectName ?? "Untitled"}" from ${from} to ${to}`;
    }
    case "project.archived":
      return `${userName} archived project "${ctx.projectName ?? "Untitled"}"`;
    case "project.deleted":
      return `${userName} deleted project "${ctx.projectName ?? "Untitled"}"`;

    // ---- Tasks ----
    case "task.created":
      return `${userName} created task "${ctx.taskTitle ?? "Untitled"}"${ctx.projectName ? ` in ${ctx.projectName}` : ""}`;
    case "task.updated":
      return `${userName} updated task "${ctx.taskTitle ?? "Untitled"}"`;
    case "task.status_changed": {
      const from = label(ctx.metadata?.oldStatus);
      const to = label(ctx.metadata?.newStatus);
      return `${userName} changed task "${ctx.taskTitle ?? "Untitled"}" from ${from} to ${to}`;
    }
    case "task.priority_changed": {
      const from = label(ctx.metadata?.oldPriority);
      const to = label(ctx.metadata?.newPriority);
      return `${userName} changed priority of "${ctx.taskTitle ?? "Untitled"}" from ${from} to ${to}`;
    }
    case "task.assigned": {
      const assigneeName = ctx.targetUserName;
      if (assigneeName) {
        return `${userName} assigned task "${ctx.taskTitle ?? "Untitled"}" to ${assigneeName}`;
      }
      return `${userName} unassigned task "${ctx.taskTitle ?? "Untitled"}"`;
    }
    case "task.deleted":
      return `${userName} deleted task "${ctx.taskTitle ?? "Untitled"}"`;
    case "task.comment":
      return `${userName} commented on task "${ctx.taskTitle ?? "Untitled"}"`;

    // ---- Dashboard / Analytics ----
    case "dashboard.viewed":
      return `${userName} viewed the dashboard`;

    default:
      // Fallback — just return whatever description was stored
      return `${userName} performed ${action}`;
  }
}

// ---------------------------------------------------------------------------
// Icon type classification for frontend rendering
// ---------------------------------------------------------------------------

export type ActivityIconType =
  | "created"
  | "updated"
  | "deleted"
  | "member"
  | "comment"
  | "status"
  | "assigned"
  | "invitation"
  | "default";

const actionToIconType: Record<string, ActivityIconType> = {
  "organization.created": "created",
  "organization.updated": "updated",
  "organization.deleted": "deleted",

  "member.joined": "member",
  "member.role_changed": "member",
  "member.removed": "deleted",

  "invitation.created": "invitation",
  "invitation.accepted": "member",
  "invitation.cancelled": "deleted",

  "team.created": "created",
  "team.updated": "updated",
  "team.deleted": "deleted",
  "team.member_added": "member",
  "team.member_removed": "deleted",

  "project.created": "created",
  "project.updated": "updated",
  "project.status_changed": "status",
  "project.archived": "updated",
  "project.deleted": "deleted",

  "task.created": "created",
  "task.updated": "updated",
  "task.status_changed": "status",
  "task.priority_changed": "status",
  "task.assigned": "assigned",
  "task.deleted": "deleted",
  "task.comment": "comment",

  "dashboard.viewed": "default",
};

export function getActivityIconType(action: string): ActivityIconType {
  return actionToIconType[action] ?? "default";
}