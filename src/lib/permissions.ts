import type { UserRole } from "@prisma/client";

type Action =
  | "delete_org"
  | "manage_members"
  | "change_roles"
  | "create_project"
  | "edit_project"
  | "delete_project"
  | "create_task"
  | "edit_any_task"
  | "delete_any_task"
  | "view_members"
  | "view_activity"
  | "manage_teams"
  | "org_settings"
  | "view_projects";

const permissionMatrix: Record<UserRole, Set<Action>> = {
  OWNER: new Set([
    "delete_org",
    "manage_members",
    "change_roles",
    "create_project",
    "edit_project",
    "delete_project",
    "create_task",
    "edit_any_task",
    "delete_any_task",
    "view_members",
    "view_activity",
    "manage_teams",
    "org_settings",
    "view_projects",
  ]),
  ADMIN: new Set([
    "manage_members",
    "change_roles",
    "create_project",
    "edit_project",
    "delete_project",
    "create_task",
    "edit_any_task",
    "delete_any_task",
    "view_members",
    "view_activity",
    "manage_teams",
    "org_settings",
    "view_projects",
  ]),
  MEMBER: new Set([
    "create_task",
    "view_members",
    "view_activity",
    "view_projects",
  ]),
};

export function canPerform(action: string, role: UserRole): boolean {
  const allowed = permissionMatrix[role];
  return allowed?.has(action as Action) ?? false;
}

export function getPermissionsForRole(role: UserRole): Action[] {
  return Array.from(permissionMatrix[role] ?? []);
}