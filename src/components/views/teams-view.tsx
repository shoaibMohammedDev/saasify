"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  FolderKanban,
  Users,
  Loader2,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface TeamMemberBasic {
  user: {
    id: number;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface TeamData {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  members: TeamMemberBasic[];
  _count: {
    members: number;
    projects: number;
  };
}

export function TeamsView() {
  const { selectedOrgId, selectTeam } = useAppStore();
  const canManageTeams = useOrgPermission("manage_teams");

  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTeams = useCallback(
    async (searchQuery?: string) => {
      if (!selectedOrgId) return;
      setLoading(true);

      try {
        const url = searchQuery
          ? `/api/organizations/${selectedOrgId}/teams?search=${encodeURIComponent(searchQuery)}`
          : `/api/organizations/${selectedOrgId}/teams`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams ?? []);
        } else {
          toast.error("Failed to load teams");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [selectedOrgId]
  );

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeams(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchTeams]);

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (!selectedOrgId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view teams.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Organize your members into teams and assign projects.
          </p>
        </div>
        {canManageTeams && (
          <Button
            className="gap-2 self-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            Create Team
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="mb-4 h-3 w-48" />
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton
                        key={j}
                        className="size-7 rounded-full border-2 border-background"
                      />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-3 size-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {search
                ? "No teams match your search"
                : "No teams yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search
                ? "Try a different search term"
                : "Create a team to organize your members."}
            </p>
            {canManageTeams && !search && (
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => selectTeam(team.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold">
                      {team.name}
                    </h3>
                    {team.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {team.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {/* Stacked member avatars */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.user.id}
                          className="size-7 border-2 border-background"
                        >
                          <AvatarImage src={m.user.image ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(m.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {team._count.members > 4 && (
                        <div className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                          +{team._count.members - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {team._count.members}{" "}
                      {team._count.members === 1 ? "member" : "members"}
                    </span>
                  </div>

                  {/* Project count */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderKanban className="size-3.5" />
                    <span>
                      {team._count.projects}{" "}
                      {team._count.projects === 1 ? "project" : "projects"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={selectedOrgId}
        onCreated={() => fetchTeams()}
      />
    </div>
  );
}