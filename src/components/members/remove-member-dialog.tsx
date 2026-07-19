"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    userId: number;
    name: string;
    role: string;
  } | null;
  orgId: number;
  onMemberRemoved?: () => void;
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  member,
  orgId,
  onMemberRemoved,
}: RemoveMemberDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleRemove() {
    if (!member) return;
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/members/${member.userId}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to remove member");
        setDeleting(false);
        return;
      }

      toast.success(`${member.name} has been removed from the workspace`);
      onOpenChange(false);
      onMemberRemoved?.();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (!member) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure? <strong>{member.name}</strong> will lose access to
            this workspace, including all projects and tasks within it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            Remove Member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}