"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  MessageSquare,
  ArrowRightLeft,
  UserCheck,
  Mail,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { socketClient, type ActivityNewPayload } from "@/lib/socket";
import {
  getActivityIconType,
  type ActivityIconType,
} from "@/lib/activity-descriptions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityUser {
  id: number;
  name: string;
  email: string;
  image: string | null;
}

interface ActivityProject {
  id: number;
  name: string;
}

interface ActivityTask {
  id: number;
  title: string;
  status: string;
}

interface ActivityItem {
  id: number;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: number;
  orgId: number;
  projectId: number | null;
  taskId: number | null;
  user: ActivityUser;
  project: ActivityProject | null;
  task: ActivityTask | null;
}

interface ActivityFeedProps {
  orgId: number;
  projectId?: number;
  userId?: number;
  action?: string;
  limit?: number;
  showHeader?: boolean;
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const iconConfig: Record<
  ActivityIconType,
  { icon: LucideIcon; className: string }
> = {
  created: {
    icon: Plus,
    className:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  updated: {
    icon: Pencil,
    className:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  deleted: {
    icon: Trash2,
    className:
      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  },
  member: {
    icon: UserPlus,
    className:
      "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  comment: {
    icon: MessageSquare,
    className: "bg-secondary text-secondary-foreground",
  },
  status: {
    icon: ArrowRightLeft,
    className:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
  assigned: {
    icon: UserCheck,
    className:
      "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  },
  invitation: {
    icon: Mail,
    className:
      "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  },
  default: {
    icon: Activity,
    className: "bg-secondary text-secondary-foreground",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({
  orgId,
  projectId,
  userId,
  action,
  limit = 20,
  showHeader = true,
  onTaskClick,
  onProjectClick,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchActivities = useCallback(
    async (pageNum: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(limit),
        });
        if (projectId !== undefined) params.set("projectId", String(projectId));
        if (userId !== undefined) params.set("userId", String(userId));
        if (action && action !== "all") params.set("action", action);

        const res = await fetch(
          `/api/organizations/${orgId}/activity?${params.toString()}`
        );

        if (res.ok) {
          const data = await res.json();
          if (append) {
            setActivities((prev) => [...prev, ...data.activities]);
          } else {
            setActivities(data.activities);
          }
          setHasMore(data.hasMore);
          setPage(pageNum);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [orgId, projectId, userId, action, limit]
  );

  useEffect(() => {
    setActivities([]);
    setHasMore(false);
    setPage(1);
    fetchActivities(1, false);
  }, [orgId, projectId, userId, action, fetchActivities]);

  // ---- Socket: prepend new activities in real-time ----
  useEffect(() => {
    const unsub = socketClient.onActivityNew((data: ActivityNewPayload) => {
      if (data.orgId !== orgId) return;
      // If filtered to a specific projectId, only prepend if it matches
      if (projectId !== undefined && data.activity.projectId !== projectId) return;
      // If filtered to a specific userId, only prepend if it matches
      if (userId !== undefined && data.activity.userId !== userId) return;
      // If filtered to a specific action, only prepend if it matches
      if (action && action !== "all" && data.activity.action !== action) return;

      // Deduplicate: don't add if already in the list
      setActivities((prev) => {
        if (prev.some((a) => a.id === data.activity.id)) return prev;
        return [data.activity as ActivityItem, ...prev];
      });

      // Highlight animation
      setHighlightId(data.activity.id);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 3000);
    });

    return () => {
      unsub();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [orgId, projectId, userId, action]);

  function handleLoadMore() {
    fetchActivities(page + 1, true);
  }

  // ----- Skeleton -----
  if (loading) {
    return (
      <div className="space-y-0">
        {showHeader && (
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Recent Activity
          </h3>
        )}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="relative flex gap-3 pb-6">
            {/* Icon skeleton */}
            <div className="flex flex-col items-center">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              {i < 4 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>
            {/* Content skeleton */}
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ----- Empty state -----
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Activity className="mb-3 size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No recent activity
        </p>
      </div>
    );
  }

  // ----- Feed -----
  return (
    <div className="space-y-0">
      {showHeader && (
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Recent Activity
        </h3>
      )}

      <div className="relative">
        {activities.map((item, index) => {
          const iconType = getActivityIconType(item.action);
          const { icon: Icon, className: iconClassName } = iconConfig[iconType];
          const isLast = index === activities.length - 1;

          return (
            <div
              key={item.id}
              className={cn(
                "relative flex gap-3 pb-6 transition-colors duration-700",
                highlightId === item.id &&
                  "bg-primary/5 rounded-lg px-2 -mx-2"
              )}
            >
              {/* Left: icon column */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    iconClassName
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Right: content */}
              <div className="min-w-0 flex-1 pt-0.5">
                {/* Line 1: avatar + name + description */}
                <div className="flex items-start gap-1.5">
                  <Avatar className="size-5 shrink-0">
                    <AvatarImage
                      src={item.user.image ?? undefined}
                      alt={item.user.name}
                    />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(item.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{item.user.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {item.description}
                    </span>
                  </p>
                </div>

                {/* Line 2: relative time */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>

                {/* Line 3: related entity links */}
                {(item.project || item.task) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    in{" "}
                    {item.project && (
                      <button
                        type="button"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => onProjectClick?.(item.project!.id)}
                      >
                        {item.project.name}
                      </button>
                    )}
                    {item.project && item.task && (
                      <span className="mx-1">→</span>
                    )}
                    {item.task && (
                      <button
                        type="button"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => onTaskClick?.(item.task!.id)}
                      >
                        {item.task.title}
                      </button>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}