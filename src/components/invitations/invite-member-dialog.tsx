"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check, Link } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  onInvited?: () => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  orgId,
  onInvited,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("MEMBER");
      setErrors({});
      setLoading(false);
      setInviteLink("");
      setCopied(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), role }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: data.error || "Already invited or a member" });
        } else if (data?.details) {
          const fieldErrors = data.details as Record<string, string[]>;
          for (const [key, msgs] of Object.entries(fieldErrors)) {
            if (msgs.length > 0) newErrors[key] = msgs[0];
          }
          setErrors(newErrors);
        } else {
          toast.error(data.error || "Failed to send invitation");
        }
        return;
      }

      // Build invite link
      const token = data.invitation.token;
      const appUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://your-app.com";
      const link = `${appUrl}/?invite=${token}`;
      setInviteLink(link);

      toast.success(`Invitation sent to ${email.trim()}`);
      onInvited?.();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  // After invite is sent, show the link copy section
  if (inviteLink) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Invitation Sent!</DialogTitle>
            <DialogDescription>
              Share this link with the invitee. They&apos;ll be able to join
              your workspace by accepting it.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={inviteLink}
                  readOnly
                  className="pl-9 pr-3 font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {copied ? "Copied to clipboard!" : "Click to copy the invite link"}
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to someone to join your workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="space-y-2">
                {(["ADMIN", "MEMBER"] as const).map((r) => (
                  <label
                    key={r}
                    htmlFor={`invite-role-${r}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors",
                      role === r
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <input
                      id={`invite-role-${r}`}
                      type="radio"
                      name="invite-role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {r === "ADMIN" ? "Admin" : "Member"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r === "ADMIN"
                          ? "Can manage members, teams, and settings"
                          : "Can create projects and tasks"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}