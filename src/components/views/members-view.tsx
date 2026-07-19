"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  Mail,
  Clock,
  Loader2,
  Users,
  Copy,
  Check,
  Link,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { socketClient, type PresenceUpdatePayload } from "@/lib/socket";
import { RoleBadge } from "@/components/members/role-badge";
import { ChangeRoleDialog } from "@/components/members/change-role-dialog";
import { RemoveMemberDialog } from "@/components/members/remove-member-dialog";
import { InviteMemberDialog } from "@/components/invitations/invite-member-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MemberData {
  id: number;
  role: string;
  joinedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface InvitationData {
  id: number;
  email: string;
  role: string;
  token: string;
  inviterName: string;
  expiresAt: string;
  createdAt: string;
}

export function MembersView() {
  const { selectedOrgId, user } = useAppStore();
  const canManageMembers = useOrgPermission("manage_members");
  const canChangeRoles = useOrgPermission("change_roles");

  const [members, setMembers] = useState<MemberData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

  // Dialogs
  const [roleDialogMember, setRoleDialogMember] = useState<{
    userId: number;
    name: string;
    currentRole: string;
  } | null>(null);
  const [removeDialogMember, setRemoveDialogMember] = useState<{
    userId: number;
    name: string;
    role: string;
  } | null>(null);

  const fetchMembers = useCallback(
    async (searchQuery?: string) => {
      if (!selectedOrgId) return;
      setLoading(true);

      try {
        const url = searchQuery
          ? `/api/organizations/${selectedOrgId}/members?search=${encodeURIComponent(searchQuery)}`
          : `/api/organizations/${selectedOrgId}/members`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members);
          setInvitations(data.invitations ?? []);
        } else {
          toast.error("Failed to load members");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [selectedOrgId]
  );

  // Also fetch invitations separately (the members endpoint only returns a subset)
  const fetchInvitations = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/invitations`
      );
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations ?? []);
      }
    } catch {
      // Silently fail — invitations section is supplementary
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchMembers]);

  // ---- Socket: track online users ----
  useEffect(() => {
    const unsub = socketClient.onPresenceUpdate(
      (data: PresenceUpdatePayload) => {
        if (data.orgId === selectedOrgId) {
          setOnlineUserIds(
            new Set(data.onlineUsers.map((u) => u.userId))
          );
        }
      }
    );
    return unsub;
  }, [selectedOrgId]);

  // Clear online users when switching orgs
  useEffect(() => {
    setOnlineUserIds(new Set());
  }, [selectedOrgId]);

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  async function handleCancelInvitation(inv: InvitationData) {
    if (!selectedOrgId) return;

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrgId}/invitations/${inv.id}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success(`Invitation to ${inv.email} cancelled`);
        fetchInvitations();
        fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel invitation");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function handleCopyLink(inv: InvitationData) {
    const appUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    const link = `${appUrl}/?invite=${inv.token}`;

    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  if (!selectedOrgId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an organization to view members.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace members and roles.
          </p>
        </div>
        {canManageMembers && (
          <Button
            className="gap-2 self-start"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="size-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Members Table (desktop) */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No members match your search" : "No members yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search
                ? "Try a different search term"
                : "Invite someone to join your workspace"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isSelf = user?.id === m.user.id;
                  const isOwner = m.role === "OWNER";
                  const canAct = canManageMembers && !isSelf && !isOwner;

                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="size-9">
                              <AvatarImage
                                src={m.user.image ?? undefined}
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(m.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            {onlineUserIds.has(m.user.id) && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {m.user.name}
                              {isSelf && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={m.role} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {formatDate(m.joinedAt)}
                      </TableCell>
                      <TableCell>
                        {canAct && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">
                                  Actions for {m.user.name}
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canChangeRoles && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRoleDialogMember({
                                      userId: m.user.id,
                                      name: m.user.name,
                                      currentRole: m.role,
                                    })
                                  }
                                >
                                  <ShieldCheck className="mr-2 size-4" />
                                  Change Role
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setRemoveDialogMember({
                                    userId: m.user.id,
                                    name: m.user.name,
                                    role: m.role,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 size-4" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="space-y-2 md:hidden">
            {members.map((m) => {
              const isSelf = user?.id === m.user.id;
              const isOwner = m.role === "OWNER";
              const canAct = canManageMembers && !isSelf && !isOwner;

              return (
                <Card key={m.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="relative">
                      <Avatar className="size-10">
                        <AvatarImage src={m.user.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(m.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUserIds.has(m.user.id) && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {m.user.name}
                        </p>
                        {isSelf && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            (you)
                          </span>
                        )}
                        <RoleBadge role={m.role} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.user.email}
                      </p>
                    </div>
                    {canAct && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canChangeRoles && (
                            <DropdownMenuItem
                              onClick={() =>
                                setRoleDialogMember({
                                  userId: m.user.id,
                                  name: m.user.name,
                                  currentRole: m.role,
                                })
                              }
                            >
                              <ShieldCheck className="mr-2 size-4" />
                              Change Role
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              setRemoveDialogMember({
                                userId: m.user.id,
                                name: m.user.name,
                                role: m.role,
                              })
                            }
                          >
                            <Trash2 className="mr-2 size-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Pending Invitations */}
      {!loading && invitations.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending Invitations ({invitations.length})
          </h2>

          {/* Desktop: Table */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead className="hidden sm:table-cell">Expires</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        <span className="text-sm">{inv.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={inv.role} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.inviterName}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(inv.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopyLink(inv)}
                        >
                          <Copy className="size-3" />
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleCancelInvitation(inv)}
                        >
                          <Trash2 className="size-3" />
                          <span className="hidden sm:inline">Cancel</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="space-y-2 md:hidden">
            {invitations.map((inv) => (
              <Card key={inv.id} className="border-dashed">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Mail className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {inv.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{inv.inviterName}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(inv.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <RoleBadge role={inv.role} />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleCopyLink(inv)}
                    >
                      <Link className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => handleCancelInvitation(inv)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No invitations empty state */}
      {!loading && invitations.length === 0 && canManageMembers && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Mail className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No pending invitations
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &quot;Invite Member&quot; to send your first invitation.
          </p>
        </div>
      )}

      {/* Dialogs */}
      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={selectedOrgId}
        onInvited={() => {
          fetchInvitations();
          setInviteOpen(false);
        }}
      />

      <ChangeRoleDialog
        open={!!roleDialogMember}
        onOpenChange={(open) => !open && setRoleDialogMember(null)}
        member={roleDialogMember}
        orgId={selectedOrgId}
        onRoleChanged={() => fetchMembers()}
      />

      <RemoveMemberDialog
        open={!!removeDialogMember}
        onOpenChange={(open) => !open && setRemoveDialogMember(null)}
        member={removeDialogMember}
        orgId={selectedOrgId}
        onMemberRemoved={() => fetchMembers()}
      />
    </div>
  );
}