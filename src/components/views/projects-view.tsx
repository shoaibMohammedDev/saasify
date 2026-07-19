"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  FolderKanban,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { ProjectCard, type ProjectData } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = "ALL" | "ACTIVE" | "ARCHIVED";

interface TeamOption {
  id: number;
  name: string;
}

export function ProjectsView() {
  const { selectedOrgId, selectProject } = useAppStore();
  const canCreate = useOrgPermission("create_project");

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Team options for filter
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);

  const fetchTeams = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeamOptions(
          (data.teams ?? []).map((t: { id: number; name: string }) => ({
            id: t.id,
            name: t.name,
          }))
        );
      }
    } catch {
      // silent
    }
  }, [selectedOrgId]);

  const fetchProjects = useCallback(
    async (pageNum: number, overrides?: { status?: StatusFilter; teamId?: string; searchQuery?: string }) => {
      if (!selectedOrgId) return;
      setLoading(true);

      const s = overrides?.status ?? statusFilter;
      const t = overrides?.teamId ?? teamFilter;
      const q = overrides?.searchQuery ?? search;

      try {
        const params = new URLSearchParams({
          status: s,
          page: String(pageNum),
          limit: String(limit),
        });
        if (t !== "all") params.set("teamId", t);
        if (q) params.set("search", q);

        const res = await fetch(
          `/api/organizations/${selectedOrgId}/projects?${params}`
        );
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 1);
        } else {
          toast.error("Failed to load projects");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [selectedOrgId, statusFilter, teamFilter, search, limit]
  );

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    fetchProjects(1);
  }, [statusFilter, teamFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects(1, { searchQuery: search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function handleStatusChange(value: string) {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  }

  function handleTeamChange(value: string) {
    setTeamFilter(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  if (!selectedOrgId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view projects.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your workspace projects.
          </p>
        </div>
        {canCreate && (
          <Button
            className="gap-2 self-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex items-center gap-1">
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => handleStatusChange(s)}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}

          {/* Team filter */}
          <Select value={teamFilter} onValueChange={handleTeamChange}>
            <SelectTrigger className="h-8 w-[140px] text-xs ml-2">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {total} project{total !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="mb-3 size-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || statusFilter !== "ALL" || teamFilter !== "all"
                ? "No projects match your filters"
                : "No projects yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || statusFilter !== "ALL" || teamFilter !== "all"
                ? "Try adjusting your filters"
                : "Create a project to start tracking your work."}
            </p>
            {canCreate &&
              !search &&
              statusFilter === "ALL" &&
              teamFilter === "all" && (
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  New Project
                </Button>
              )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project cards grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={selectProject}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  fetchProjects(p);
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
                className="h-8 gap-1"
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  fetchProjects(p);
                }}
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </>
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={selectedOrgId}
        onCreated={() => fetchProjects(1)}
      />
    </div>
  );
}