"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TaskPriorityBadge } from "./task-priority-badge";
import type { TaskListItem } from "./task-list";

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
    case "MEDIUM":
      return "border-l-blue-500";
    case "HIGH":
      return "border-l-amber-500";
    case "URGENT":
      return "border-l-red-500";
    default:
      return "";
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

interface KanbanCardProps {
  task: TaskListItem;
  onClick: (taskId: number) => void;
  isDragging?: boolean;
  overlay?: boolean;
}

export function KanbanCard({
  task,
  onClick,
  isDragging,
  overlay,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id, data: { status: task.status } });

  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  const priorityBorder = getPriorityBorderColor(task.priority);

  return (
    <div
      ref={!overlay ? setNodeRef : undefined}
      style={style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={(e) => {
        if (!isDragging) onClick(task.id);
      }}
      className={`
        group rounded-lg border bg-card p-3 transition-all duration-200
        ${priorityBorder ? `border-l-2 ${priorityBorder}` : "border-l-0"}
        ${isDragging ? "opacity-50" : ""}
        ${overlay ? "shadow-lg rotate-2 scale-105" : "cursor-grab active:cursor-grabbing hover:bg-accent/50 hover:shadow-sm"}
      `}
    >
      {/* Title — 2 line clamp */}
      <p className="line-clamp-2 text-sm font-medium leading-snug mb-2">
        {task.title}
      </p>

      {/* Bottom row: priority + assignee + due date */}
      <div className="flex items-center gap-2">
        <TaskPriorityBadge priority={task.priority} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Due date */}
        {task.dueDate && (
          <span
            className={`text-[10px] tabular-nums whitespace-nowrap ${
              isOverdue(task.dueDate) && task.status !== "DONE"
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Assignee avatar */}
        {task.assignee && (
          <Avatar className="size-5 shrink-0">
            <AvatarImage src={task.assignee.image ?? undefined} />
            <AvatarFallback className="text-[7px]">
              {getInitials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}