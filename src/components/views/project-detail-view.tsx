"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  FolderKanban,
  CheckCircle2,
  Clock,
  Circle,
  List,
  LayoutGrid,
  Loader2,
  Plus,
  Users,
  TriangleAlert,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import {
  socketClient,
  type TaskUpdatedPayload,
  type TaskCreatedPayload,
  type TaskDeletedPayload,
} from "@/lib/socket";
import { TaskList } from "@/components/tasks/task-list";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { TaskStats } from "@/components/projects/project-card";

interface ProjectDetail {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  totalTasks: number;
  taskCompletion: number;
  taskStats: TaskStats;
  team?: {
    id: number;
    name: string;
    members: {
      user: {
        id: number;
        name: string;
        image?: string | null;
      };
    }[];
    _count: { members: number };
  } | null;
  creator?: {
    id: number;
    name: string;
    image?: string | null;
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProjectDetailView() {
  const {
    user,
    selectedOrgId,
    selectedProjectId,
    selectedTaskId,
    organizations,
    setView,
    selectTask,
    taskViewMode,
    projectTaskViewModes,
    setTaskViewMode,
  } = useAppStore();

  const canEdit = useOrgPermission("edit_project");
  const canDelete = useOrgPermission("delete_project");
  const canCreateTask = useOrgPermission("create_task");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit project dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTeamId, setEditTeamId] = useState<string>("none");
  const [editLoading, setEditLoading] = useState(false);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);

  // Create task dialog
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Archive toggle loading
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Task detail sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else if (res.status === 404) {
        setError("Project not found");
      } else {
        toast.error("Failed to load project");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  const fetchTeams = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeams((data.teams ?? []).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch {
      // silent
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ---- Socket: refetch project when tasks change in this project ----
  useEffect(() => {
    if (!selectedProjectId) return;

    const unsubUpdate = socketClient.onTaskUpdate((data: TaskUpdatedPayload) => {
      if (data.projectId === selectedProjectId && data.userId !== user?.id) {
        fetchProject();
        toast.info(`${data.userName ?? "Someone"} updated a task`);
      }
    });

    const unsubCreate = socketClient.onTaskCreated((data: TaskCreatedPayload) => {
      if (data.projectId === selectedProjectId && data.task?.id) {
        fetchProject();
        toast.info(`${data.userName ?? "Someone"} created "${data.task.title}"`);
      }
    });

    const unsubDelete = socketClient.onTaskDeleted((data: TaskDeletedPayload) => {
      if (data.projectId === selectedProjectId && data.userId !== user?.id) {
        fetchProject();
        toast.info("A task was deleted");
      }
    });

    return () => {
      unsubUpdate();
      unsubCreate();
      unsubDelete();
    };
  }, [selectedProjectId, user?.id, fetchProject]);

  // Restore per-project view mode when project changes
  useEffect(() => {
    if (selectedProjectId && projectTaskViewModes[selectedProjectId]) {
      setTaskViewMode(projectTaskViewModes[selectedProjectId]);
    }
  }, [selectedProjectId, projectTaskViewModes, setTaskViewMode]);

  // Open task detail sheet when selectedTaskId changes
  useEffect(() => {
    if (selectedTaskId) {
      setSheetOpen(true);
    }
  }, [selectedTaskId]);

  // Close sheet and clear selectedTaskId
  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      selectTask(0);
    }
  }

  function handleTaskClick(taskId: number) {
    selectTask(taskId);
  }

  // Edit dialog
  function openEditDialog() {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditTeamId(project.team?.id ? String(project.team.id) : "none");
    fetchTeams();
    setEditOpen(true);
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;

    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      };
      if (editTeamId !== "none") {
        body.teamId = Number(editTeamId);
      } else {
        body.teamId = null;
      }

      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Project updated");
        setEditOpen(false);
        fetchProject();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update project");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEditLoading(false);
    }
  }

  // Archive toggle
  async function handleArchiveToggle() {
    if (!selectedProjectId || !project) return;
    const newStatus = project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === "ACTIVE" ? "Project unarchived" : "Project archived");
        fetchProject();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update project");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setArchiveLoading(false);
    }
  }

  // Delete
  async function handleDeleteProject() {
    if (!selectedProjectId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Project deleted");
        setView("projects");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete project");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Get org name
  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  const orgName = currentOrg?.name ?? "Organization";

  // Error state
  if (!loading && error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center justify-center py-16">
          <TriangleAlert className="mb-4 size-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setView("projects")}
          >
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-64" />

        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <div className="flex-1">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="mt-1 h-4 w-96" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content skeleton */}
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Project not found.</p>
        </div>
      </div>
    );
  }

  const stats = project.taskStats ?? { total: 0, done: 0, inProgress: 0, todo: 0 };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button
          className="hover:text-foreground transition-colors"
          onClick={() => setView("projects")}
        >
          {orgName}
        </button>
        <span className="text-muted-foreground/50">/</span>
        <button
          className="hover:text-foreground transition-colors"
          onClick={() => setView("projects")}
        >
          Projects
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setView("projects")}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to projects</span>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {project.name}
              </h1>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    if (project.status === "ACTIVE") {
                      handleArchiveToggle();
                    } else {
                      handleArchiveToggle();
                    }
                  }}
                  disabled={archiveLoading}
                >
                  {archiveLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : project.status === "ACTIVE" ? (
                    <Archive className="size-3" />
                  ) : (
                    <ArchiveRestore className="size-3" />
                  )}
                  {project.status === "ACTIVE" ? "Archive" : "Unarchive"}
                </Button>
              )}
            </div>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={openEditDialog}
            >
              <Pencil className="size-4" />
              <span className="sr-only">Edit project</span>
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete project</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{project.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this project and all its tasks.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    disabled={deleteLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Delete Project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canCreateTask && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setCreateTaskOpen(true)}
            >
              <Plus className="size-4" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FolderKanban className="size-4" />
              <span className="text-xs font-medium">Total Tasks</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <CheckCircle2 className="size-4" />
              <span className="text-xs font-medium">Done</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {stats.done}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <Clock className="size-4" />
              <span className="text-xs font-medium">In Progress</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {stats.inProgress}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Circle className="size-4" />
              <span className="text-xs font-medium">To Do</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stats.todo}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team members row */}
      {project.team && project.team.members.length > 0 && (
        <div className="flex items-center gap-3">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{project.team.name}</span>
          <div className="flex -space-x-1.5">
            {project.team.members.slice(0, 5).map((m) => (
              <Avatar
                key={m.user.id}
                className="size-6 border border-background"
              >
                <AvatarImage src={m.user.image ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {getInitials(m.user.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {project.team._count.members > 5 && (
              <div className="flex size-6 items-center justify-center rounded-full border border-background bg-muted text-[8px] font-medium">
                +{project.team._count.members - 5}
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {project.team._count.members} member
            {project.team._count.members !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      <Separator />

      {/* View toggle + task content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Tasks
          </h2>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={taskViewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs px-2.5"
              onClick={() => setTaskViewMode("list", selectedProjectId ?? undefined)}
            >
              <List className="size-3.5" />
              List
            </Button>
            <Button
              variant={taskViewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs px-2.5"
              onClick={() => setTaskViewMode("board", selectedProjectId ?? undefined)}
            >
              <LayoutGrid className="size-3.5" />
              Board
            </Button>
          </div>
        </div>

        {taskViewMode === "list" ? (
          <TaskList
            projectId={selectedProjectId!}
            onTaskClick={handleTaskClick}
            onUpdated={fetchProject}
          />
        ) : (
          <KanbanBoard
            projectId={selectedProjectId!}
            onTaskClick={handleTaskClick}
            onUpdated={fetchProject}
          />
        )}
      </div>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onUpdate={() => {
          fetchProject();
        }}
        onDelete={() => {
          fetchProject();
          setView("projects");
        }}
      />

      {/* Create Task Dialog (from header button) */}
      {canCreateTask && (
        <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quick Add Task</DialogTitle>
              <DialogDescription>
                Enter a title to quickly create a task. You can edit details
                later.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const title = formData.get("quick-title") as string;
                if (!title?.trim()) return;

                try {
                  const res = await fetch(
                    `/api/projects/${selectedProjectId}/tasks`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: title.trim() }),
                    }
                  );
                  if (res.ok) {
                    toast.success("Task created");
                    setCreateTaskOpen(false);
                    fetchProject();
                  } else {
                    const data = await res.json();
                    toast.error(data.error || "Failed to create task");
                  }
                } catch {
                  toast.error("Something went wrong");
                }
              }}
            >
              <Input
                name="quick-title"
                placeholder="Task title..."
                maxLength={200}
                autoFocus
              />
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateTaskOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Name</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                autoFocus
                disabled={editLoading}
              />
              <p className="text-xs text-muted-foreground text-right tabular-nums">
                {editName.length}/100
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="edit-project-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={500}
                rows={3}
                disabled={editLoading}
              />
              <p className="text-xs text-muted-foreground text-right tabular-nums">
                {editDescription.length}/500
              </p>
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={editTeamId}
                onValueChange={setEditTeamId}
                disabled={editLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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