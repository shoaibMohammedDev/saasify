"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  CheckSquare,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Rocket,
  Plus,
  CalendarDays,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";

import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalMembers: number;
  overdueTasks: number;
}

interface TaskDistribution {
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

interface MyTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: number; name: string };
}

interface RecentActivityItem {
  id: number;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: number;
  orgId: number;
  projectId: number | null;
  taskId: number | null;
  user: { id: number; name: string; email: string; image: string | null };
  project: { id: number; name: string } | null;
  task: { id: number; title: string; status: string } | null;
}

interface ProjectProgress {
  name: string;
  total: number;
  completed: number;
}

interface DashboardData {
  stats: DashboardStats;
  taskDistribution: TaskDistribution;
  recentActivity: RecentActivityItem[];
  myTasks: MyTask[];
  projectProgress: ProjectProgress[];
}

// ---------------------------------------------------------------------------
// Chart config
// ---------------------------------------------------------------------------

const chartConfig = {
  todo: {
    label: "To Do",
    color: "hsl(var(--muted-foreground) / 0.35)",
  },
  inProgress: {
    label: "In Progress",
    color: "hsl(210 90% 55%)",
  },
  inReview: {
    label: "In Review",
    color: "hsl(38 92% 55%)",
  },
  done: {
    label: "Done",
    color: "hsl(142 71% 45%)",
  },
} satisfies ChartConfig;

const CHART_COLORS = [
  "hsl(var(--muted-foreground) / 0.35)",
  "hsl(210 90% 55%)",
  "hsl(38 92% 55%)",
  "hsl(142 71% 45%)",
] as const;

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const priorityConfig: Record<
  string,
  { label: string; className: string }
> = {
  URGENT: { label: "Urgent", className: "bg-red-500" },
  HIGH: { label: "High", className: "bg-orange-500" },
  MEDIUM: { label: "Medium", className: "bg-amber-500" },
  LOW: { label: "Low", className: "bg-slate-400" },
};

// ---------------------------------------------------------------------------
// Stat Card component
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ElementType;
  iconClassName: string;
  value: string | number;
  label: string;
}

function StatCard({ icon: Icon, iconClassName, value, label }: StatCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            iconClassName
          )}
        >
          <Icon className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums leading-tight">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard View
// ---------------------------------------------------------------------------

export function DashboardView() {
  const { selectedOrgId, organizations, selectProject, setView } =
    useAppStore();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const orgName =
    organizations.find((o) => o.id === selectedOrgId)?.name ?? "Dashboard";

  // ---- Fetch dashboard data ----
  const fetchDashboard = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/dashboard`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ---- Task detail sheet ----
  const [sheetTaskId, setSheetTaskId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleTaskClick(taskId: number) {
    setSheetTaskId(taskId);
    setSheetOpen(true);
  }

  // ---- Overdue banner click → go to projects view ----
  function handleOverdueClick() {
    setView("projects");
  }

  // ---- No org guard ----
  if (!selectedOrgId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view the dashboard.
        </p>
      </div>
    );
  }

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-2.5 rounded-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3 */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- No data / empty state ----
  if (
    !data ||
    (data.stats.totalProjects === 0 &&
      data.stats.totalTasks === 0 &&
      data.stats.totalMembers <= 1)
  ) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
          <p className="text-sm text-muted-foreground">Dashboard overview</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Rocket className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Your workspace is ready!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to get started
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={() => setView("projects")}
            >
              <Plus className="size-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, taskDistribution, myTasks, projectProgress } = data;
  const completionRate =
    stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;

  // Chart data
  const chartData = [
    { status: "To Do", value: taskDistribution.todo, fill: CHART_COLORS[0] },
    {
      status: "In Progress",
      value: taskDistribution.inProgress,
      fill: CHART_COLORS[1],
    },
    {
      status: "In Review",
      value: taskDistribution.inReview,
      fill: CHART_COLORS[2],
    },
    { status: "Done", value: taskDistribution.done, fill: CHART_COLORS[3] },
  ].filter((d) => d.value > 0);

  // ---- Render ----
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
        <p className="text-sm text-muted-foreground">Dashboard overview</p>
      </div>

      {/* ===== Row 1: Stat Cards ===== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={FolderKanban}
          iconClassName="bg-primary"
          value={stats.totalProjects}
          label="Total Projects"
        />
        <StatCard
          icon={CheckSquare}
          iconClassName="bg-sky-500"
          value={stats.totalTasks}
          label="Total Tasks"
        />
        <StatCard
          icon={Users}
          iconClassName="bg-violet-500"
          value={stats.totalMembers}
          label="Team Members"
        />
        <StatCard
          icon={TrendingUp}
          iconClassName="bg-emerald-500"
          value={`${completionRate}%`}
          label="Completion Rate"
        />
      </div>

      {/* ===== Overdue warning ===== */}
      {stats.overdueTasks > 0 && (
        <div
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
          onClick={handleOverdueClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleOverdueClick();
          }}
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {stats.overdueTasks} task{stats.overdueTasks !== 1 ? "s are" : " is"}{" "}
            overdue
          </p>
          <ArrowRight className="ml-auto size-4 text-amber-600 dark:text-amber-400" />
        </div>
      )}

      {/* ===== Row 2: Chart + My Tasks ===== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Task Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Distribution</CardTitle>
            <CardDescription>
              Tasks grouped by current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No tasks yet
                </p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="status"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Right: My Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">My Tasks</CardTitle>
              {myTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {myTasks.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col">
            {myTasks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-8">
                <CheckSquare className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No tasks assigned to you
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {myTasks.map((task) => {
                  const prio = priorityConfig[task.priority] ?? priorityConfig.MEDIUM;
                  const isOverdue =
                    task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));

                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      onClick={() => handleTaskClick(task.id)}
                    >
                      {/* Priority dot */}
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          prio.className
                        )}
                      />

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {task.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.project.name}
                        </p>
                      </div>

                      {/* Due date */}
                      {task.dueDate && (
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 text-xs tabular-nums",
                            isOverdue
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="size-3" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* View all link */}
            {myTasks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-auto gap-1 text-xs text-muted-foreground"
                onClick={() => setView("projects")}
              >
                View All Tasks
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Row 3: Recent Activity ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => setView("activity")}
            >
              View All
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* We render the recent activity from the dashboard API inline
              rather than using the ActivityFeed component (which fetches its own data)
              to avoid a duplicate API call. */}
          <InlineActivityList
            activities={data.recentActivity}
            onTaskClick={handleTaskClick}
            onProjectClick={selectProject}
          />
        </CardContent>
      </Card>

      {/* ===== Task Detail Sheet ===== */}
      <TaskDetailSheet
        taskId={sheetTaskId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Activity List (renders pre-fetched recent activity)
// ---------------------------------------------------------------------------

function InlineActivityList({
  activities,
  onTaskClick,
  onProjectClick,
}: {
  activities: RecentActivityItem[];
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
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

  return (
    <div className="space-y-0">
      <div className="relative">
        {activities.map((item, index) => {
          const isLast = index === activities.length - 1;

          return (
            <div key={item.id} className="relative flex gap-3 pb-6">
              {/* Left: avatar */}
              <div className="flex flex-col items-center">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[8px] font-medium">
                  {getInitials(item.user.name)}
                </div>
                {!isLast && <div className="w-px flex-1 bg-border" />}
              </div>

              {/* Right: content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{item.user.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {item.description}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>

                {/* Related entity links */}
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
                      <span className="mx-1">&rarr;</span>
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
    </div>
  );
}