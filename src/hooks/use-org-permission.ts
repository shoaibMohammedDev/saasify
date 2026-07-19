"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { canPerform } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

/**
 * Check if the current user can perform a specific action in the selected org.
 * Returns false if no org is selected or user has no membership.
 */
export function useOrgPermission(action: string): boolean {
  const { organizations, selectedOrgId } = useAppStore();

  return useMemo(() => {
    if (!selectedOrgId) return false;

    const currentOrg = organizations.find((o) => o.id === selectedOrgId);
    if (!currentOrg) return false;

    return canPerform(action, currentOrg.role as UserRole);
  }, [action, organizations, selectedOrgId]);
}

/**
 * Get the current user's role in the selected org.
 * Returns null if no org is selected.
 */
export function useOrgRole(): string | null {
  const { organizations, selectedOrgId } = useAppStore();

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  return currentOrg?.role ?? null;
}