"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar,
  User as UserIcon,
  MessageSquare,
} from "lucide-react";

import { useOrgPermission } from "@/hooks/use-org-permission";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";
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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  comments: Comment[];
}

interface TaskDetailSheetProps {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

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
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const priorityOptions = [
  { value: "LOW", label: "Low", dotColor: "bg-muted-foreground/50" },
  { value: "MEDIUM", label: "Medium", dotColor: "bg-blue-500" },
  { value: "HIGH", label: "High", dotColor: "bg-amber-500" },
  { value: "URGENT", label: "Urgent", dotColor: "bg-red-500" },
];

export function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: TaskDetailSheetProps) {
  const canEdit = useOrgPermission("create_task"); // All members can edit their own tasks; API enforces fine-grained RBAC
  const canDelete = useOrgPermission("delete_any_task");

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");

  // Field updates
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Comment
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
      } else {
        toast.error("Failed to load task");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      fetchTask();
    } else {
      setTask(null);
      setEditingTitle(false);
      setEditingDescription(false);
      setCommentText("");
    }
  }, [open, taskId, fetchTask]);

  useEffect(() => {
    if (task?.comments) {
      // Scroll to bottom of comments after loading
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [task?.comments?.length]);

  async function handleUpdateField(field: string, value: unknown) {
    if (!taskId) return;
    setUpdatingField(field);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("Updated");
        fetchTask();
        onUpdate?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdatingField(null);
    }
  }

  function handleSaveTitle() {
    if (!editTitleValue.trim()) {
      setEditingTitle(false);
      return;
    }
    handleUpdateField("title", editTitleValue.trim());
    setEditingTitle(false);
  }

  function handleSaveDescription() {
    handleUpdateField(
      "description",
      editDescriptionValue.trim() || null
    );
    setEditingDescription(false);
  }

  async function handleDelete() {
    if (!taskId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Task deleted");
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
        setCommentText("");
        fetchTask();
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

  function startEditTitle() {
    if (!task) return;
    setEditTitleValue(task.title);
    setEditingTitle(true);
  }

  function startEditDescription() {
    if (!task) return;
    setEditDescriptionValue(task.description ?? "");
    setEditingDescription(true);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[500px] p-0 flex flex-col"
        >
          {loading ? (
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Separator />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Separator />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
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
          ) : task ? (
            <>
              {/* Header */}
              <SheetHeader className="p-4 pb-0 space-y-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
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
                          className="h-8 text-lg font-semibold"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          onClick={handleSaveTitle}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          onClick={() => setEditingTitle(false)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <SheetTitle className="text-lg leading-tight">
                          {task.title}
                        </SheetTitle>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 mt-0.5"
                            onClick={startEditTitle}
                          >
                            <Pencil className="size-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <SheetDescription className="sr-only">
                  Task details and comments
                </SheetDescription>
                <div className="flex items-center gap-2 pt-2 pb-3">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                </div>
              </SheetHeader>

              <Separator />

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Description
                      </Label>
                      {canEdit && !editingDescription && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={startEditDescription}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {editingDescription ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editDescriptionValue}
                          onChange={(e) =>
                            setEditDescriptionValue(e.target.value)
                          }
                          maxLength={1000}
                          rows={4}
                          autoFocus
                          placeholder="Add a description..."
                        />
                        <p className="text-xs text-muted-foreground text-right tabular-nums">
                          {editDescriptionValue.length}/1000
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleSaveDescription}
                            disabled={updatingField === "description"}
                          >
                            {updatingField === "description" && (
                              <Loader2 className="mr-1 size-3 animate-spin" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingDescription(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
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

                  {/* Assignee */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <UserIcon className="inline size-3 mr-1 -mt-0.5" />
                      Assignee
                    </Label>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage
                            src={task.assignee.image ?? undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(task.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Calendar className="inline size-3 mr-1 -mt-0.5" />
                      Due Date
                    </Label>
                    {canEdit ? (
                      <Input
                        type="date"
                        value={task.dueDate ? task.dueDate.split("T")[0] : ""}
                        onChange={(e) =>
                          handleUpdateField(
                            "dueDate",
                            e.target.value || null
                          )
                        }
                        className="h-8 w-fit text-sm"
                        disabled={updatingField === "dueDate"}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {task.dueDate
                          ? formatDate(task.dueDate)
                          : "No due date"}
                      </span>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Priority
                    </Label>
                    {canEdit ? (
                      <Select
                        value={task.priority}
                        onValueChange={(v) => handleUpdateField("priority", v)}
                        disabled={updatingField === "priority"}
                      >
                        <SelectTrigger className="h-8 w-fit text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={`inline-block size-2 rounded-full ${opt.dotColor}`}
                                />
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <TaskPriorityBadge priority={task.priority} />
                    )}
                  </div>

                  <Separator />

                  {/* Delete button */}
                  {canDelete && (
                    <div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete Task
                      </Button>
                    </div>
                  )}

                  <Separator />

                  {/* Comments */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <MessageSquare className="inline size-3 mr-1 -mt-0.5" />
                      Comments ({task.comments?.length ?? 0})
                    </Label>

                    {/* Comment list */}
                    <div className="space-y-3">
                      {task.comments && task.comments.length > 0 ? (
                        task.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5">
                            <Avatar className="size-7 shrink-0 mt-0.5">
                              <AvatarImage
                                src={comment.user.image ?? undefined}
                              />
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
                    <form
                      onSubmit={handleAddComment}
                      className="flex gap-2 items-start"
                    >
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="min-h-[60px] text-sm flex-1"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="shrink-0 h-8 text-xs"
                        disabled={
                          !commentText.trim() || submittingComment
                        }
                      >
                        {submittingComment ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
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
              This will permanently delete this task and all its comments. This
              action cannot be undone.
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