"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  CheckSquare,
} from "lucide-react";

import { useOrgPermission } from "@/hooks/use-org-permission";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";
import { CreateTaskDialog } from "./create-task-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TaskListItem {
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
}

interface TaskListProps {
  projectId: number;
  onTaskClick: (taskId: number) => void;
  onUpdated?: () => void;
}

type StatusFilter = "ALL" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type PriorityFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type SortField = "title" | "status" | "priority" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc";

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

const priorityTabs: { value: PriorityFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const statusOptions = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPriorityBorderColor(priority: string): string {
  switch (priority) {
    case "LOW":
      return "border-l-muted-foreground/30";
    case "MEDIUM":
      return "border-l-blue-500";
    case "HIGH":
      return "border-l-amber-500";
    case "URGENT":
      return "border-l-red-500";
    default:
      return "border-l-muted-foreground/30";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target < today;
}

export function TaskList({ projectId, onTaskClick, onUpdated }: TaskListProps) {
  const canCreate = useOrgPermission("create_task");
  // Show actions to anyone who can interact with tasks (API enforces fine-grained RBAC)
  const canInteract = canCreate;

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [search, setSearch] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Status change loading per task
  const [changingStatus, setChangingStatus] = useState<number | null>(null);

  // Delete loading per task
  const [deletingTask, setDeletingTask] = useState<number | null>(null);

  const fetchTasks = useCallback(
    async (pageNum: number) => {
      if (!projectId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(limit),
          sortBy,
          sortDir,
        });
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
        if (search) params.set("search", search);

        const res = await fetch(
          `/api/projects/${projectId}/tasks?${params}`
        );
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 1);
        } else {
          toast.error("Failed to load tasks");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [projectId, statusFilter, priorityFilter, search, sortBy, sortDir, limit]
  );

  useEffect(() => {
    fetchTasks(1);
  }, [statusFilter, priorityFilter, sortBy, sortDir]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTasks(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function handleStatusFilter(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  function handlePriorityFilter(value: PriorityFilter) {
    setPriorityFilter(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function _handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  async function handleChangeStatus(taskId: number, newStatus: string) {
    setChangingStatus(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success("Status updated");
        fetchTasks(page);
        onUpdated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setChangingStatus(null);
    }
  }

  async function handleDeleteTask(taskId: number) {
    setDeletingTask(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Task deleted");
        fetchTasks(page);
        onUpdated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete task");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingTask(null);
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border p-3 border-l-2 border-l-muted-foreground/20"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="size-7" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {statusTabs.map((s) => (
            <Button
              key={s.value}
              variant={statusFilter === s.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              onClick={() => handleStatusFilter(s.value)}
            >
              {s.label}
            </Button>
          ))}

          {/* Priority filter */}
          <div className="ml-2 hidden sm:block h-5 w-px bg-border" />
          <div className="flex items-center gap-1 ml-1">
            {priorityTabs.map((p) => (
              <Button
                key={p.value}
                variant={priorityFilter === p.value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs font-medium px-2.5"
                onClick={() => handlePriorityFilter(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs w-full sm:w-[180px]"
            />
          </div>

          {/* Add Task */}
          {canCreate && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Task count */}
      <p className="text-xs text-muted-foreground">
        {total} task{total !== 1 ? "s" : ""}
      </p>

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <CheckSquare className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search || statusFilter !== "ALL" || priorityFilter !== "ALL"
              ? "No tasks match your filters"
              : "No tasks yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search || statusFilter !== "ALL" || priorityFilter !== "ALL"
              ? "Try adjusting your filters"
              : "Create your first task to get started."}
          </p>
          {canCreate &&
            !search &&
            statusFilter === "ALL" &&
            priorityFilter === "ALL" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-3.5" />
                Add Task
              </Button>
            )}
        </div>
      )}

      {/* Task rows */}
      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`group flex items-center gap-3 rounded-lg border border-l-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${getPriorityBorderColor(task.priority)}`}
            onClick={() => onTaskClick(task.id)}
          >
            {/* Title */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {task.title}
              </p>
            </div>

            {/* Status badge */}
            <TaskStatusBadge status={task.status} />

            {/* Priority badge */}
            <TaskPriorityBadge priority={task.priority} />

            {/* Assignee */}
            {task.assignee ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="size-6 shrink-0">
                    <AvatarImage src={task.assignee.image ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(task.assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{task.assignee.name}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="size-6 shrink-0" />
            )}

            {/* Due date */}
            {task.dueDate && (
              <span
                className={`shrink-0 text-[11px] tabular-nums whitespace-nowrap ${
                  isOverdue(task.dueDate) && task.status !== "DONE"
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {isOverdue(task.dueDate) && task.status !== "DONE"
                  ? formatDate(task.dueDate)
                  : formatDate(task.dueDate)}
              </span>
            )}

            {/* Actions dropdown */}
            {(canInteract) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CheckSquare className="size-3.5" />
                      Change Status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {statusOptions.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            disabled={changingStatus === task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangeStatus(task.id, opt.value);
                            }}
                          >
                            {changingStatus === task.id && (
                              <Loader2 className="mr-2 size-3.5 animate-spin" />
                            )}
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  {canCreate && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={deletingTask === task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                      >
                        {deletingTask === task.id ? (
                          <Loader2 className="mr-2 size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 size-3.5" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={page <= 1}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              fetchTasks(p);
            }}
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={page >= totalPages}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              fetchTasks(p);
            }}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        onCreated={() => fetchTasks(1)}
      />
    </div>
  );
}