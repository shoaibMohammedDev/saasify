"use client";

const priorityConfig: Record<
  string,
  { label: string; className: string }
> = {
  LOW: {
    label: "Low",
    className: "bg-secondary text-secondary-foreground",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  HIGH: {
    label: "High",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  URGENT: {
    label: "Urgent",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const dotColors: Record<string, string> = {
  LOW: "bg-muted-foreground/50",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-500",
};

interface TaskPriorityBadgeProps {
  priority: string;
}

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority] ?? priorityConfig.MEDIUM;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${dotColors[priority] ?? dotColors.MEDIUM}`}
      />
      {config.label}
    </span>
  );
}