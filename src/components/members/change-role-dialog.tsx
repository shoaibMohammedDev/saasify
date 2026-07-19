"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import type { UserRole } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    userId: number;
    name: string;
    currentRole: string;
  } | null;
  orgId: number;
  onRoleChanged?: () => void;
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  orgId,
  onRoleChanged,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens or member changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedRole("");
      setLoading(false);
    }
    onOpenChange(newOpen);
  };

  async function handleSubmit() {
    if (!member || !selectedRole) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/members/${member.userId}/role`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: selectedRole }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to change role");
        return;
      }

      toast.success(
        `${member.name}'s role changed to ${selectedRole}`
      );
      onOpenChange(false);
      onRoleChanged?.();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!member) return null;

  const isDemotion =
    (member.currentRole === "ADMIN" && selectedRole === "MEMBER") ||
    (member.currentRole === "OWNER" && (selectedRole === "ADMIN" || selectedRole === "MEMBER"));

  const roles: { value: UserRole; label: string; desc: string }[] = [
    {
      value: "ADMIN",
      label: "Admin",
      desc: "Can manage members, teams, projects, and settings",
    },
    {
      value: "MEMBER",
      label: "Member",
      desc: "Can create projects and tasks, view members and activity",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Change <strong>{member.name}</strong>&apos;s role in this
            workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {roles.map((role) => (
            <label
              key={role.value}
              htmlFor={`role-${role.value}`}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-colors",
                selectedRole === role.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  id={`role-${role.value}`}
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={() => setSelectedRole(role.value)}
                  className="accent-primary"
                />
                <Label
                  htmlFor={`role-${role.value}`}
                  className="cursor-pointer text-sm font-medium"
                >
                  {role.label}
                </Label>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">
                {role.desc}
              </p>
            </label>
          ))}

          {isDemotion && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                You are demoting this member. They will lose access to
                management features.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedRole}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Update Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}