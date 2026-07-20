"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { ActivityFeed } from "@/components/activity/activity-feed";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types for filter data
// ---------------------------------------------------------------------------

interface ProjectOption {
  id: number;
  name: string;
}

interface MemberOption {
  user: {
    id: number;
    name: string;
    image?: string | null;
  };
}

const ACTION_OPTIONS = [
  { value: "all", label: "All Activity" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "comments", label: "Comments" },
  { value: "assignments", label: "Assignments" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityView() {
  const { selectedOrgId, selectProject, selectTask } = useAppStore();

  // Filter state
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // Filter options data
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [filtersLoaded] = useState(false);

  // Fetch filter options
  const fetchFilters = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      const [projectsRes, membersRes] = await Promise.all([
        fetch(`/api/organizations/${selectedOrgId}/projects`),
        fetch(`/api/organizations/${selectedOrgId}/members`),
      ]);

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects ?? []);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      // Filters loaded
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  // Reset filters when org changes
  useEffect(() => {
    setProjectFilter("all");
    setUserFilter("all");
    setActionFilter("all");
  }, [selectedOrgId]);

  // Derived filter values
  const projectIdNum =
    projectFilter !== "all" ? Number(projectFilter) : undefined;
  const userIdNum =
    userFilter !== "all" ? Number(userFilter) : undefined;

  // Click handlers
  function handleTaskClick(taskId: number) {
    selectTask(taskId);
  }

  function handleProjectClick(projectId: number) {
    selectProject(projectId);
  }

  if (!selectedOrgId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view activity.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Track all changes across your workspace
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="size-4 text-muted-foreground" />

        {/* Project filter */}
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]" size="sm">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User filter */}
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[180px]" size="sm">
            <SelectValue placeholder="All Members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.user.id} value={String(m.user.id)}>
                {m.user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action type filter */}
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]" size="sm">
            <SelectValue placeholder="All Activity" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity feed */}
      <ActivityFeed
        orgId={selectedOrgId}
        projectId={projectIdNum}
        userId={userIdNum}
        action={actionFilter}
        showHeader={false}
        onTaskClick={handleTaskClick}
        onProjectClick={handleProjectClick}
      />
    </div>
  );
}