"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  FolderKanban,
  Users,
  TriangleAlert,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { RoleBadge } from "@/components/members/role-badge";
import { AddTeamMemberDropdown } from "@/components/teams/add-team-member-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";

interface TeamMemberData {
  id: number;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    image?: string | null;
  };
  member?: {
    role: string;
  };
}

interface TeamProjectData {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
}

interface TeamDetailData {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  members: TeamMemberData[];
  projects: TeamProjectData[];
  _count: {
    members: number;
    projects: number;
  };
}

export function TeamDetailView() {
  const { selectedOrgId, selectedTeamId, setView } = useAppStore();
  const canManageTeams = useOrgPermission("manage_teams");

  const [team, setTeam] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Remove member loading
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!selectedOrgId || !selectedTeamId) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/teams/${selectedTeamId}`
      );
      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
      } else {
        toast.error("Failed to load team");
        setView("teams");
      }
    } catch {
      toast.error("Something went wrong");
      setView("teams");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, selectedTeamId, setView]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  function openEditDialog() {
    if (!team) return;
    setEditName(team.name);
    setEditDescription(team.description ?? "");
    setEditOpen(true);
  }

  async function handleUpdateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId || !selectedTeamId) return;

    setEditLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/teams/${selectedTeamId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim() || undefined,
          }),
        }
      );
      if (res.ok) {
        toast.success("Team updated");
        setEditOpen(false);
        fetchTeam();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update team");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteTeam() {
    if (!selectedOrgId || !selectedTeamId) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/teams/${selectedTeamId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Team deleted");
        setView("teams");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete team");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleRemoveMember(userId: number, userName: string) {
    if (!selectedOrgId || !selectedTeamId) return;

    setRemovingUserId(userId);
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/teams/${selectedTeamId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(`${userName} removed from team`);
        fetchTeam();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingUserId(null);
    }
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Team not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setView("teams")}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to teams</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {team.name}
              </h1>
              {canManageTeams && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={openEditDialog}
                >
                  <Pencil className="size-3.5" />
                  <span className="sr-only">Edit team</span>
                </Button>
              )}
            </div>
            {team.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {team.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Members Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Members
              <Badge variant="secondary" className="font-normal">
                {team._count.members}
              </Badge>
            </CardTitle>
            {canManageTeams && (
              <AddTeamMemberDropdown
                orgId={selectedOrgId!}
                teamId={selectedTeamId!}
                onAdded={fetchTeam}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {team.members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members in this team yet.
              {canManageTeams && " Click \"Add Member\" to get started."}
            </p>
          ) : (
            <div className="space-y-1">
              {team.members.map((tm) => (
                <div
                  key={tm.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="size-9">
                    <AvatarImage src={tm.user.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(tm.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tm.user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tm.user.email}
                    </p>
                  </div>
                  {tm.member && <RoleBadge role={tm.member.role} />}
                  {canManageTeams && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        handleRemoveMember(tm.user.id, tm.user.name)
                      }
                      disabled={removingUserId === tm.user.id}
                    >
                      {removingUserId === tm.user.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      <span className="sr-only">Remove {tm.user.name}</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="size-4" />
            Projects
            <Badge variant="secondary" className="font-normal">
              {team._count.projects}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {team.projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No projects assigned to this team yet.
            </p>
          ) : (
            <div className="space-y-1">
              {team.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() =>
                    useAppStore.getState().selectProject(project.id)
                  }
                >
                  <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      project.status === "ACTIVE" ? "default" : "secondary"
                    }
                    className="shrink-0 text-[10px]"
                  >
                    {project.status === "ACTIVE" ? "Active" : "Archived"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {canManageTeams && (
        <>
          <Separator />
          <Card className="border-destructive/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <TriangleAlert className="size-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Delete this team</p>
                  <p className="text-xs text-muted-foreground">
                    This will remove all members from the team and unassign all
                    projects. This action cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 self-start"
                    >
                      Delete Team
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &quot;{team.name}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove all members from the team
                        and unassign all projects. Existing projects will not be
                        deleted. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTeam}
                        disabled={deleteLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteLoading && (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Delete Team
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update your team&apos;s name and description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Name</Label>
              <Input
                id="edit-team-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={editLoading}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editName.length}/50
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="edit-team-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={200}
                rows={3}
                disabled={editLoading}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editDescription.length}/200
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editName.trim() || editLoading}
              >
                {editLoading && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}