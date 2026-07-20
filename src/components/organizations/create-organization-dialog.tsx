"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setSlug(generateSlug(name));
    }
  }, [name, slugManuallyEdited]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setSlugManuallyEdited(false);
      setErrors({});
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});

      // Client-side validation
      const newErrors: Record<string, string> = {};
      if (name.trim().length < 2) {
        newErrors.name = "Name must be at least 2 characters";
      }
      if (!slug || slug.length < 2) {
        newErrors.slug = "Slug must be at least 2 characters";
      } else if (!/^[a-z0-9-]+$/.test(slug)) {
        newErrors.slug =
          "Slug can only contain lowercase letters, numbers, and hyphens";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), slug }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            setErrors({ slug: "This slug is already taken" });
          } else if (data?.details) {
            const fieldErrors = data.details as Record<string, string[]>;
            for (const [key, msgs] of Object.entries(fieldErrors)) {
              if (msgs.length > 0) {
                newErrors[key] = msgs[0];
              }
            }
            setErrors(newErrors);
          } else {
            toast.error(data.error || "Failed to create organization");
          }
          return;
        }

        toast.success(`Workspace "${data.organization.name}" created!`);
        onOpenChange(false);
        onCreated?.();
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [name, slug, onOpenChange, onCreated]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              A workspace lets you organize your projects and collaborate with
              your team.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name">Workspace Name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="org-slug">URL Slug</Label>
              <div className="relative">
                <Input
                  id="org-slug"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                  }}
                  disabled={loading}
                  className="pr-28"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  .saasify.app
                </span>
              </div>
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {slug
                  ? `saasify.app/${slug}`
                  : "Your workspace URL will appear here"}
              </p>
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
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}