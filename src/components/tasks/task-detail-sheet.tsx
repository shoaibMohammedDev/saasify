"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  MessageSquare,
  Calendar,
  User as UserIcon,
  FolderKanban,
  Check,
  ChevronsUpDown,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { socketClient } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: number;
  description: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    image?: string | null;
  };
}

interface TaskDetail {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: number;
  project?: {
    id: number;
    name: string;
  };
  assignee?: {
    id: number;
    name: string;
    image?: string | null;
  } | null;
  creator: {
    id: number;
    name: string;
    image?: string | null;
  };
}

interface TeamMember {
  user: {
    id: number;
    name: string;
    image?: string | null;
  };
}

interface TaskDetailSheetProps {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dateStr: string, status: string): boolean {
  if (status === "DONE") return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target < today;
}

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------

const statusOptions = [
  { value: "TODO", label: "To Do", color: "bg-secondary text-secondary-foreground" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "IN_REVIEW", label: "In Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "DONE", label: "Done", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
];

const priorityOptions = [
  { value: "LOW", label: "Low", dotColor: "bg-muted-foreground/50", color: "bg-secondary text-secondary-foreground" },
  { value: "MEDIUM", label: "Medium", dotColor: "bg-blue-500", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "HIGH", label: "High", dotColor: "bg-amber-500", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "URGENT", label: "Urgent", dotColor: "bg-red-500", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: TaskDetailSheetProps) {
  const { user, selectedOrgId } = useAppStore();
  const canEdit = useOrgPermission("create_task");
  const canDelete = useOrgPermission("delete_any_task");

  // ---- Task data ----
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  // ---- Edit states ----
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [descriptionDirty, setDescriptionDirty] = useState(false);

  // ---- Field update loading ----
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  // ---- Status / Priority popover ----
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  // ---- Assignee popover ----
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // ---- Due date popover ----
  const [dueDateOpen, setDueDateOpen] = useState(false);

  // ---- Delete dialog ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ---- Comment ----
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ---- Description debounce timer ----
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =========================================================================
  // Fetch task
  // =========================================================================

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setNotFound(false);

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.status === 404) {
        setNotFound(true);
        toast.error("This task has been deleted");
        onOpenChange(false);
        onDelete?.();
        onUpdate?.();
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setComments(data.comments ?? []);
        setDescriptionValue(data.task.description ?? "");
        setDescriptionDirty(false);
      } else {
        toast.error("Failed to load task");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [taskId, onOpenChange, onDelete, onUpdate]);

  useEffect(() => {
    if (open && taskId) {
      fetchTask();
      // Fetch team members for assignee selector
      if (task?.projectId) {
        fetchMembers(task.projectId);
      }
    } else {
      setTask(null);
      setComments([]);
      setEditingTitle(false);
      setDescriptionValue("");
      setDescriptionDirty(false);
      setCommentText("");
      setNotFound(false);
    }
  }, [open, taskId]);

  // Fetch members when task loads (for assignee dropdown)
  useEffect(() => {
    if (open && task?.projectId) {
      fetchMembers(task.projectId);
    }
  }, [open, task?.projectId]);

  // Scroll comments to bottom when loaded
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [comments.length]);

  // Cleanup description debounce on unmount
  useEffect(() => {
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    };
  }, []);

  // =========================================================================
  // Fetch team members
  // =========================================================================

  const fetchMembers = useCallback(async (projectId: number) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.project?.team?.members ?? []);
      }
    } catch {
      // silent
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // =========================================================================
  // Field update with optimistic UI
  // =========================================================================

  async function handleUpdateField(
    field: string,
    value: unknown,
    optimisticUpdate?: (t: TaskDetail) => TaskDetail
  ) {
    if (!taskId || !task) return;
    setUpdatingField(field);

    // Optimistic update
    if (optimisticUpdate) {
      setTask(optimisticUpdate(task));
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        onUpdate?.();
        if (selectedOrgId && user && task) {
          socketClient.emitTaskUpdated({
            taskId: task.id,
            projectId: task.projectId,
            orgId: selectedOrgId,
            userId: user.id,
            changes: { [field]: value },
            userName: user.name,
          });
        }
      } else {
        // Revert on error
        const data = await res.json();
        toast.error(data.error || "Failed to update");
        fetchTask(); // refetch to revert
      }
    } catch {
      toast.error("Something went wrong");
      fetchTask(); // refetch to revert
    } finally {
      setUpdatingField(null);
    }
  }

  // =========================================================================
  // Title editing (double-click)
  // =========================================================================

  function handleTitleDoubleClick() {
    if (!task || !canEdit) return;
    setEditTitleValue(task.title);
    setEditingTitle(true);
  }

  function handleSaveTitle() {
    if (!editTitleValue.trim()) {
      setEditingTitle(false);
      return;
    }
    const trimmed = editTitleValue.trim();
    if (trimmed !== task?.title) {
      handleUpdateField("title", trimmed);
    }
    setEditingTitle(false);
  }

  // =========================================================================
  // Description (auto-save on blur with debounce)
  // =========================================================================

  function handleDescriptionChange(value: string) {
    setDescriptionValue(value);
    setDescriptionDirty(value !== (task?.description ?? ""));

    // Debounced save
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      handleSaveDescription(value);
    }, 800);
  }

  async function handleSaveDescription(value?: string) {
    const val = value ?? descriptionValue;
    const trimmed = val.trim();
    if (trimmed === (task?.description ?? "")) {
      setDescriptionDirty(false);
      return;
    }
    setUpdatingField("description");
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed || null }),
      });
      if (res.ok) {
        setDescriptionDirty(false);
        onUpdate?.();
        if (selectedOrgId && user && task) {
          socketClient.emitTaskUpdated({
            taskId: task.id,
            projectId: task.projectId,
            orgId: selectedOrgId,
            userId: user.id,
            changes: { description: trimmed || null },
            userName: user.name,
          });
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save description");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdatingField(null);
    }
  }

  function handleDescriptionBlur() {
    // Save immediately on blur if dirty
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    if (descriptionDirty) {
      handleSaveDescription();
    }
  }

  // =========================================================================
  // Status / Priority change
  // =========================================================================

  function handleStatusChange(newStatus: string) {
    if (!task || newStatus === task.status) {
      setStatusOpen(false);
      return;
    }
    setStatusOpen(false);
    toast.success("Status updated");
    handleUpdateField(
      "status",
      newStatus,
      (t) => ({ ...t, status: newStatus })
    );
  }

  function handlePriorityChange(newPriority: string) {
    if (!task || newPriority === task.priority) {
      setPriorityOpen(false);
      return;
    }
    setPriorityOpen(false);
    toast.success("Priority updated");
    handleUpdateField(
      "priority",
      newPriority,
      (t) => ({ ...t, priority: newPriority })
    );
  }

  // =========================================================================
  // Assignee change
  // =========================================================================

  function handleAssigneeChange(userId: number | null) {
    setAssigneeOpen(false);
    handleUpdateField(
      "assigneeId",
      userId,
      (t) => {
        if (userId === null) return { ...t, assignee: null };
        const member = members.find((m) => m.user.id === userId);
        return {
          ...t,
          assignee: member
            ? { id: member.user.id, name: member.user.name, image: member.user.image }
            : null,
        };
      }
    );
  }

  // =========================================================================
  // Due date change
  // =========================================================================

  function handleDueDateSelect(date: Date | undefined) {
    setDueDateOpen(false);
    if (!date) {
      handleUpdateField("dueDate", null, (t) => ({ ...t, dueDate: null }));
      return;
    }
    const dateStr = date.toISOString().split("T")[0];
    handleUpdateField("dueDate", dateStr, (t) => ({ ...t, dueDate: dateStr }));
  }

  function handleClearDueDate() {
    setDueDateOpen(false);
    handleUpdateField("dueDate", null, (t) => ({ ...t, dueDate: null }));
  }

  // =========================================================================
  // Delete
  // =========================================================================

  async function handleDelete() {
    if (!taskId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Task deleted");
        if (selectedOrgId && task) {
          socketClient.emitTaskDeleted({
            taskId,
            projectId: task.projectId,
            orgId: selectedOrgId,
          });
        }
        onOpenChange(false);
        onDelete?.();
        onUpdate?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete task");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  // =========================================================================
  // Comments
  // =========================================================================

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommentText("");
        fetchTask();
        onUpdate?.();
        if (selectedOrgId && user && task) {
          const activity = data.activity ?? {
            id: Date.now(),
            action: "comment.added",
            description: `Commented on "${task.title}"`,
            metadata: null,
            createdAt: new Date().toISOString(),
            userId: user.id,
            orgId: selectedOrgId,
            projectId: task.projectId,
            taskId: task.id,
            user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
            project: task.project ? { id: task.project.id, name: task.project.name } : null,
            task: { id: task.id, title: task.title, status: task.status },
          };
          socketClient.emitActivityNew({ activity, orgId: selectedOrgId });
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add comment");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (commentText.trim() && !submittingComment) {
        handleAddComment(e);
      }
    }
  }

  // =========================================================================
  // Helper: get current status/priority config
  // =========================================================================

  const currentStatus = statusOptions.find((s) => s.value === task?.status) ?? statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.value === task?.priority) ?? priorityOptions[1];

  // =========================================================================
  // Render: Loading skeleton
  // =========================================================================

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] p-0 flex flex-col"
        >
          <div className="flex-1 p-6 space-y-5">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <Separator />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-5 w-32" />
            <Separator />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // =========================================================================
  // Render: Main
  // =========================================================================

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] p-0 flex flex-col"
        >
          {task ? (
            <>
              {/* =================== HEADER =================== */}
              <div className="px-5 pt-5 pb-0 space-y-2 shrink-0">
                {/* Title */}
                <div className="pr-8">
                  {editingTitle ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        maxLength={200}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle();
                          if (e.key === "Escape") setEditingTitle(false);
                        }}
                        onBlur={handleSaveTitle}
                        className="h-8 text-lg font-semibold"
                      />
                    </div>
                  ) : (
                    <h2
                      className="text-lg font-semibold leading-tight cursor-default select-none"
                      onDoubleClick={handleTitleDoubleClick}
                      title="Double-click to edit"
                    >
                      {task.title}
                    </h2>
                  )}
                </div>

                {/* Created by · relative time */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar className="size-4">
                    <AvatarImage src={task.creator.image ?? undefined} />
                    <AvatarFallback className="text-[7px]">
                      {getInitials(task.creator.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    Created by <span className="font-medium text-foreground/80">{task.creator.name}</span>
                    {" · "}
                    {formatRelativeTime(task.createdAt)}
                  </span>
                </div>

                {/* Status & Priority pills */}
                <div className="flex items-center gap-2 pt-1 pb-3">
                  {canEdit ? (
                    <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${currentStatus.color}`}
                        >
                          {updatingField === "status" && (
                            <Loader2 className="size-3 animate-spin" />
                          )}
                          {currentStatus.label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="start">
                        <div className="space-y-0.5">
                          {statusOptions.map((opt) => (
                            <button
                              key={opt.value}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${
                                opt.value === task.status ? "bg-accent" : ""
                              }`}
                              onClick={() => handleStatusChange(opt.value)}
                            >
                              {opt.value === task.status && (
                                <Check className="size-3.5 text-primary" />
                              )}
                              {opt.value !== task.status && (
                                <span className="w-3.5" />
                              )}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${currentStatus.color}`}>
                      {currentStatus.label}
                    </span>
                  )}

                  {canEdit ? (
                    <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${currentPriority.color}`}
                        >
                          {updatingField === "priority" && (
                            <Loader2 className="size-3 animate-spin" />
                          )}
                          <span className={`inline-block size-1.5 rounded-full ${currentPriority.dotColor}`} />
                          {currentPriority.label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="start">
                        <div className="space-y-0.5">
                          {priorityOptions.map((opt) => (
                            <button
                              key={opt.value}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${
                                opt.value === task.priority ? "bg-accent" : ""
                              }`}
                              onClick={() => handlePriorityChange(opt.value)}
                            >
                              {opt.value === task.priority && (
                                <Check className="size-3.5 text-primary" />
                              )}
                              {opt.value !== task.priority && (
                                <span className="w-3.5" />
                              )}
                              <span className={`inline-block size-2 rounded-full ${opt.dotColor}`} />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${currentPriority.color}`}>
                      <span className={`inline-block size-1.5 rounded-full ${currentPriority.dotColor}`} />
                      {currentPriority.label}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* =================== SCROLLABLE CONTENT =================== */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-6">
                  {/* ---- Description ---- */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Description
                    </Label>
                    {canEdit ? (
                      <>
                        <Textarea
                          value={descriptionValue}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          onBlur={handleDescriptionBlur}
                          maxLength={1000}
                          rows={3}
                          placeholder="Add a description..."
                          className="min-h-[80px] text-sm resize-y"
                          disabled={updatingField === "description"}
                        />
                        <div className="flex items-center justify-between">
                          {descriptionDirty && (
                            <span className="text-[10px] text-muted-foreground">
                              {updatingField === "description" ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="size-2.5 animate-spin" />
                                  Saving...
                                </span>
                              ) : (
                                "Unsaved changes"
                              )}
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                            {descriptionValue.length}/1000
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                        {task.description || (
                          <span className="text-muted-foreground italic">
                            No description
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* ---- Details grid ---- */}
                  <div className="space-y-4">
                    {/* Assignee */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        <UserIcon className="inline size-3 mr-1 -mt-0.5" />
                        Assignee
                      </Label>
                      {canEdit ? (
                        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors w-full"
                              disabled={membersLoading || updatingField === "assigneeId"}
                            >
                              {task.assignee ? (
                                <>
                                  <Avatar className="size-5">
                                    <AvatarImage src={task.assignee.image ?? undefined} />
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(task.assignee.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="flex-1 text-left">{task.assignee.name}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                              {updatingField === "assigneeId" ? (
                                <Loader2 className="size-3.5 animate-spin shrink-0" />
                              ) : (
                                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search members..." />
                              <CommandList>
                                <CommandEmpty>No members found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__unassigned"
                                    onSelect={() => handleAssigneeChange(null)}
                                  >
                                    <Check
                                      className={`mr-2 size-4 ${
                                        !task.assignee ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    Unassigned
                                  </CommandItem>
                                  {members.map((m) => (
                                    <CommandItem
                                      key={m.user.id}
                                      value={m.user.name}
                                      onSelect={() => handleAssigneeChange(m.user.id)}
                                    >
                                      <Check
                                        className={`mr-2 size-4 ${
                                          task.assignee?.id === m.user.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        }`}
                                      />
                                      <Avatar className="size-5 mr-2">
                                        <AvatarImage src={m.user.image ?? undefined} />
                                        <AvatarFallback className="text-[8px]">
                                          {getInitials(m.user.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {m.user.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex items-center gap-2">
                          {task.assignee ? (
                            <>
                              <Avatar className="size-5">
                                <AvatarImage src={task.assignee.image ?? undefined} />
                                <AvatarFallback className="text-[8px]">
                                  {getInitials(task.assignee.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assignee.name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        <Calendar className="inline size-3 mr-1 -mt-0.5" />
                        Due Date
                      </Label>
                      {canEdit ? (
                        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                                task.dueDate && isOverdue(task.dueDate, task.status)
                                  ? "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
                                  : ""
                              }`}
                              disabled={updatingField === "dueDate"}
                            >
                              {updatingField === "dueDate" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Calendar className="size-3.5 text-muted-foreground" />
                              )}
                              {task.dueDate ? (
                                <span>{formatDate(task.dueDate)}</span>
                              ) : (
                                <span className="text-muted-foreground">Set due date</span>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex flex-col">
                              <CalendarUI
                                mode="single"
                                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                                onSelect={handleDueDateSelect}
                                initialFocus
                              />
                              {task.dueDate && (
                                <div className="border-t px-2 py-1.5">
                                  <button
                                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-left px-2 py-1 rounded hover:bg-accent"
                                    onClick={handleClearDueDate}
                                  >
                                    Clear date
                                  </button>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className={`text-sm ${task.dueDate && isOverdue(task.dueDate, task.status) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                        </span>
                      )}
                    </div>

                    {/* Project */}
                    {task.project && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          <FolderKanban className="inline size-3 mr-1 -mt-0.5" />
                          Project
                        </Label>
                        <span className="text-sm">{task.project.name}</span>
                      </div>
                    )}

                    {/* Creator */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Created by
                      </Label>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarImage src={task.creator.image ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(task.creator.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{task.creator.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(task.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* ---- Comments ---- */}
                  <div className="space-y-3">
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <MessageSquare className="inline size-3 mr-1 -mt-0.5" />
                      Comments ({comments.length})
                    </Label>

                    {/* Comment list (newest first) */}
                    <div className="space-y-3">
                      {comments.length > 0 ? (
                        comments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5">
                            <Avatar className="size-7 shrink-0 mt-0.5">
                              <AvatarImage src={comment.user.image ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(comment.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-medium">
                                  {comment.user.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatRelativeTime(comment.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap">
                                {comment.description}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground py-2">
                          No comments yet.
                        </p>
                      )}
                      <div ref={commentsEndRef} />
                    </div>

                    {/* Add comment */}
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <Textarea
                        ref={commentTextareaRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={handleCommentKeyDown}
                        placeholder="Add a comment... (⌘+Enter to send)"
                        rows={2}
                        className="min-h-[60px] text-sm"
                        disabled={submittingComment}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          ⌘+Enter to send
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          disabled={!commentText.trim() || submittingComment}
                        >
                          {submittingComment ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="size-3.5" />
                          )}
                          Comment
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* =================== FOOTER =================== */}
              {canDelete && (
                <>
                  <Separator />
                  <div className="px-5 py-3 shrink-0">
                    <button
                      className="text-xs text-destructive/80 hover:text-destructive transition-colors flex items-center gap-1.5"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete task
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Task not found.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{task?.title}&rdquo; and all its
              comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}