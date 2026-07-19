"use client";

import { cn } from "@/lib/utils";

const roleStyles: Record<
  string,
  { className: string; darkClassName: string }
> = {
  OWNER: {
    className: "bg-primary text-primary-foreground",
    darkClassName: "bg-primary text-primary-foreground",
  },
  ADMIN: {
    className: "bg-amber-100 text-amber-800",
    darkClassName: "dark:bg-amber-900/50 dark:text-amber-100",
  },
  MEMBER: {
    className: "bg-muted text-muted-foreground",
    darkClassName: "dark:bg-muted dark:text-muted-foreground",
  },
};

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleStyles[role] ?? roleStyles.MEMBER;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none tracking-wide",
        config.className,
        config.darkClassName,
        className
      )}
    >
      {role}
    </span>
  );
}