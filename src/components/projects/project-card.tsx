"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface TaskStats {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
}

export interface TeamMemberBasic {
  user: {
    id: number;
    name: string;
    image?: string | null;
  };
}

export interface ProjectData {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  taskStats: TaskStats;
  taskCompletion: number;
  team?: {
    id: number;
    name: string;
    members: TeamMemberBasic[];
    _count: { members: number };
  } | null;
  creator?: {
    id: number;
    name: string;
    image?: string | null;
  };
  _count: {
    tasks: number;
  };
}

interface ProjectCardProps {
  project: ProjectData;
  onClick: (projectId: number) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getProgressColor(completion: number): string {
  if (completion === 100) return "[&>div]:bg-emerald-500";
  if (completion >= 60) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-primary";
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { taskStats, taskCompletion } = project;

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-foreground/20"
      onClick={() => onClick(project.id)}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Top: Status + Name */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <Badge
            variant={
              project.status === "ACTIVE" ? "default" : "secondary"
            }
            className={`shrink-0 text-[10px] font-medium ${
              project.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : ""
            }`}
          >
            {project.status === "ACTIVE" ? "Active" : "Archived"}
          </Badge>
        </div>

        {/* Progress bar */}
        {taskStats.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-medium tabular-nums">
                {taskCompletion}%
              </span>
            </div>
            <Progress
              value={taskCompletion}
              className={`h-1.5 ${getProgressColor(taskCompletion)}`}
            />
          </div>
        )}

        {/* Footer: Team + Task count */}
        <div className="flex items-center justify-between pt-1">
          {/* Team info */}
          {project.team ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex -space-x-1.5">
                {project.team.members.slice(0, 3).map((m) => (
                  <Avatar
                    key={m.user.id}
                    className="size-5 border border-background"
                  >
                    <AvatarImage src={m.user.image ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {project.team._count.members > 3 && (
                  <div className="flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[8px] font-medium">
                    +{project.team._count.members - 3}
                  </div>
                )}
              </div>
              <span className="truncate text-[11px] text-muted-foreground max-w-[100px]">
                {project.team.name}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              No team
            </span>
          )}

          {/* Task count */}
          {taskStats.total > 0 && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {taskStats.total} tasks · {taskStats.done} done
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}