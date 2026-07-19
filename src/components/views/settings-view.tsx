"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SettingsView() {
  const { selectedOrgId, organizations, setOrganizations, selectOrg, setView } =
    useAppStore();

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  const canManage =
    currentOrg && (currentOrg.role === "OWNER" || currentOrg.role === "ADMIN");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Org detail state
  const [orgDetail, setOrgDetail] = useState<{
    memberCount: number;
    projectCount: number;
  } | null>(null);
  const [fetching, setFetching] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch org details
  useEffect(() => {
    if (selectedOrgId) {
      setFetching(true);
      fetch(`/api/organizations/${selectedOrgId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.organization) {
            setOrgDetail({
              memberCount: data.organization.memberCount,
              projectCount: data.organization.projectCount,
            });
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [selectedOrgId]);

  // Populate form from current org
  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setSlug(currentOrg.slug);
      setErrors({});
    }
  }, [currentOrg]);

  async function handleSave() {
    if (!selectedOrgId) return;
    setErrors({});
    setLoading(true);

    try {
      const updates: Record<string, string> = {};
      if (name.trim() !== currentOrg?.name) updates.name = name.trim();
      if (slug !== currentOrg?.slug) updates.slug = slug;

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ slug: "This slug is already taken" });
        } else if (res.status === 403) {
          toast.error("You don't have permission to update this organization");
        } else {
          toast.error(data.error || "Failed to update organization");
        }
        return;
      }

      toast.success("Organization updated successfully");

      // Update Zustand cache
      setOrganizations(
        organizations.map((o) =>
          o.id === selectedOrgId
            ? { ...o, name: data.organization.name, slug: data.organization.slug }
            : o
        )
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedOrgId || deleteConfirm !== currentOrg?.name) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete organization");
        setDeleting(false);
        return;
      }

      toast.success("Organization deleted successfully");

      // Remove from cache and reset selection
      const remaining = organizations.filter((o) => o.id !== selectedOrgId);
      setOrganizations(remaining);

      if (remaining.length > 0) {
        selectOrg(remaining[0].id);
        setView("dashboard");
      } else {
        // No more orgs — store will show WelcomeView
        useAppStore.getState().selectOrg(0 as unknown as number);
        setView("dashboard");
      }

      setDeleteConfirm("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Only owners and administrators can access organization settings.
          </p>
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {currentOrg.role === "OWNER" && (
            <TabsTrigger value="danger" className="text-destructive hover:text-destructive">
              Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Details</CardTitle>
              <CardDescription>
                Update your workspace name and URL slug.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Workspace Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-slug">URL Slug</Label>
                <div className="relative">
                  <Input
                    id="settings-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    disabled={loading}
                    className="pr-28"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    .saasify.app
                  </span>
                </div>
                {errors.slug && (
                  <p className="text-xs text-destructive">{errors.slug}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {slug ? `saasify.app/${slug}` : "Your workspace URL"}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>

          {/* Stats card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-bold">
                    {fetching ? "..." : orgDetail?.memberCount ?? currentOrg.memberCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-bold">
                    {fetching ? "..." : orgDetail?.projectCount ?? currentOrg.projectCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        {currentOrg.role === "OWNER" && (
          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="size-4" />
                  Delete Workspace
                </CardTitle>
                <CardDescription>
                  Permanently delete this workspace, all its projects, tasks, teams,
                  and member data. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="size-4" />
                      Delete Workspace
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{currentOrg.name}</strong> and
                        all associated data including projects, tasks, and team
                        configurations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-2 space-y-2">
                      <Label htmlFor="delete-confirm">
                        Type <strong>{currentOrg.name}</strong> to confirm
                      </Label>
                      <Input
                        id="delete-confirm"
                        placeholder={currentOrg.name}
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirm("")}
                        disabled={deleting}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={
                          deleting || deleteConfirm !== currentOrg.name
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}