"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { UserPlus, Search, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AvailableMember {
  role: string;
  user: {
    id: number;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface AddTeamMemberDropdownProps {
  orgId: number;
  teamId: number;
  onAdded: () => void;
}

export function AddTeamMemberDropdown({
  orgId,
  teamId,
  onAdded,
}: AddTeamMemberDropdownProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<AvailableMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const fetchAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teamId: String(teamId) });
      if (search) params.set("search", search);
      const res = await fetch(
        `/api/organizations/${orgId}/members/available?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [orgId, teamId, search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      fetchAvailable();
    }
  }, [open, fetchAvailable]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (search) fetchAvailable();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, fetchAvailable]);

  async function handleAdd(userId: number, userName: string) {
    setAddingId(userId);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/teams/${teamId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      if (res.ok) {
        toast.success(`${userName} added to team`);
        setMembers((prev) => prev.filter((m) => m.user.id !== userId));
        onAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingId(null);
    }
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <UserPlus className="size-4" />
          Add Member
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="max-h-64">
          {loading && members.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No members match your search"
                  : "All org members are already in this team"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {members.map((m) => (
                <button
                  key={m.user.id}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                  onClick={() => handleAdd(m.user.id, m.user.name)}
                  disabled={addingId === m.user.id}
                >
                  <Avatar className="size-7">
                    <AvatarImage src={m.user.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.user.email}
                    </p>
                  </div>
                  {addingId === m.user.id ? (
                    <Check className="size-4 shrink-0 text-green-500" />
                  ) : (
                    <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}