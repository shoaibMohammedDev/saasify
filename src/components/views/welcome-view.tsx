"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Zap, Plus, ArrowRight } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";

export function WelcomeView() {
  const [createOpen, setCreateOpen] = useState(false);
  const { setOrganizations, selectOrg, organizations } = useAppStore();

  async function handleOrgCreated() {
    // Re-fetch organizations after creation
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations);
        if (data.organizations.length > 0) {
          selectOrg(data.organizations[0].id);
        }
      }
    } catch {
      toast.error("Failed to refresh organizations");
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* Logo / Icon */}
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="size-8 text-primary" />
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome to SaaSify!
        </h1>
        <p className="mb-8 text-sm text-muted-foreground sm:text-base">
          Create your first workspace to get started. You can always create more
          workspaces later and invite your team.
        </p>

        {/* CTA */}
        <Button
          size="lg"
          className="gap-2 px-8 text-base"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5" />
          Create Workspace
          <ArrowRight className="size-4" />
        </Button>

        {/* Hint */}
        <p className="mt-4 text-xs text-muted-foreground">
          A workspace is where you manage projects, teams, and tasks.
        </p>
      </div>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleOrgCreated}
      />
    </div>
  );
}