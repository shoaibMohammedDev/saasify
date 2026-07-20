"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Check,
  ChevronDown,
  Plus,
  Loader2,
} from "lucide-react";

import { useAppStore, type OrgInfo } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";

export function OrganizationSwitcher() {
  const {
    user,
    selectedOrgId,
    organizations,
    setOrganizations,
    selectOrg,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations as OrgInfo[]);

        // Auto-select first org if none selected
        if (!selectedOrgId && data.organizations.length > 0) {
          selectOrg(data.organizations[0].id);
        }
      }
    } catch {
      // Silently fail on initial load
    } finally {
      setLoading(false);
    }
  }, [setOrganizations, selectOrg, selectedOrgId]);

  useEffect(() => {
    if (user) {
      fetchOrgs();
    }
  }, [user, fetchOrgs]);

  async function handleCreated() {
    await fetchOrgs();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={loading}
          >
            <span className="flex items-center gap-2 truncate">
              {loading ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                  {currentOrg?.name?.[0] ?? "S"}
                </div>
              )}
              <span className="truncate text-sm">
                {currentOrg?.name ?? "Select Workspace"}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.length === 0 && !loading && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No workspaces yet
            </div>
          )}
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => selectOrg(org.id)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <div className="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                  {org.name[0]}
                </div>
                {org.name}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {org.role.toLowerCase()}
                </Badge>
                {org.id === selectedOrgId && (
                  <Check className="size-3.5 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-muted-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Create New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}