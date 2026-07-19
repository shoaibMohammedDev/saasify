"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TaskPriorityBadge } from "./task-priority-badge";
import type { TaskListItem } from "./task-list";

interface KanbanBoardProps {
  projectId: number;
  onTaskClick: (taskId: number) => void;
}

interface KanbanColumn {
  key: string;
  label: string;
  headerColor: string;
  tasks: TaskListItem[];
}

const columns: { key: string; label: string; headerColor: string }[] = [
  { key: "TODO", label: "To Do", headerColor: "border-t-muted-foreground/50" },
  { key: "IN_PROGRESS", label: "In Progress", headerColor: "border-t-blue-500" },
  { key: "IN_REVIEW", label: "In Review", headerColor: "border-t-amber-500" },
  { key: "DONE", label: "Done", headerColor: "border-t-emerald-500" },
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
  const diffDays = Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target < today;
}

export function KanbanBoard({ projectId, onTaskClick }: KanbanBoardProps) {
  const [columnData, setColumnData] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: "100",
        page: "1",
      });

      const res = await fetch(`/api/projects/${projectId}/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        const allTasks: TaskListItem[] = data.tasks ?? [];

        const mapped: KanbanColumn[] = columns.map((col) => ({
          ...col,
          tasks: allTasks.filter((t) => t.status === col.key),
        }));
        setColumnData(mapped);
      } else {
        toast.error("Failed to load tasks");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-[800px]">
          {columns.map((col) => (
            <div key={col.key} className="w-[260px] shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-5 rounded-full" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-l-2 border-l-muted-foreground/20 p-3 space-y-2"
                >
                  <Skeleton className="h-3.5 w-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-[800px] pb-2">
        {columnData.map((col) => (
          <div key={col.key} className="w-[260px] shrink-0">
            {/* Column header */}
            <div
              className={`border-t-2 ${col.headerColor} mb-3 flex items-center gap-2 pb-1`}
            >
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                {col.tasks.length}
              </span>
            </div>

            {/* Task cards */}
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {col.tasks.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground/60">
                    No tasks
                  </p>
                )}
                {col.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`group rounded-lg border border-l-2 p-3 cursor-pointer transition-colors hover:bg-muted/50 ${getPriorityBorderColor(task.priority)}`}
                    onClick={() => onTaskClick(task.id)}
                  >
                    {/* Title */}
                    <p className="truncate text-sm font-medium leading-tight mb-2">
                      {task.title}
                    </p>

                    {/* Badges + Assignee row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TaskPriorityBadge priority={task.priority} />
                      {task.assignee && (
                        <Avatar className="size-4 ml-auto">
                          <AvatarImage src={task.assignee.image ?? undefined} />
                          <AvatarFallback className="text-[7px]">
                            {getInitials(task.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <p
                        className={`mt-2 text-[11px] tabular-nums ${
                          isOverdue(task.dueDate) && task.status !== "DONE"
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}