"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TeamMember {
  user: {
    id: number;
    name: string;
    image?: string | null;
  };
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onCreated?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const priorityOptions = [
  { value: "LOW", label: "Low", dotColor: "bg-muted-foreground/50" },
  { value: "MEDIUM", label: "Medium", dotColor: "bg-blue-500" },
  { value: "HIGH", label: "High", dotColor: "bg-amber-500" },
  { value: "URGENT", label: "Urgent", dotColor: "bg-red-500" },
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assigneeName, setAssigneeName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Team members for assignee select
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.project?.team?.members ?? []);
      }
    } catch {
      // silent
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setStatus("TODO");
      setPriority("MEDIUM");
      setAssigneeId(null);
      setAssigneeName("");
      setDueDate("");
    }
  }, [open]);

  function validate(): string | null {
    if (!title.trim()) return "Title is required";
    if (title.trim().length > 200) return "Title must be 200 characters or less";
    if (description.length > 1000) return "Description must be 1000 characters or less";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        status,
        priority,
      };

      if (description.trim()) body.description = description.trim();
      if (assigneeId) body.assigneeId = assigneeId;
      if (dueDate) body.dueDate = dueDate;

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Task created");
        onOpenChange(false);
        onCreated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create task");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={200}
              autoFocus
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">
              {title.length}/200
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this task..."
              maxLength={1000}
              rows={3}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">
              {description.length}/1000
            </p>
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={submitting}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="IN_REVIEW">In Review</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={submitting}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 rounded-full ${opt.dotColor}`}
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee <span className="text-muted-foreground">(optional)</span></Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={assigneeOpen}
                  className="w-full h-9 justify-between font-normal"
                  disabled={submitting || membersLoading}
                >
                  {assigneeName || "Unassigned"}
                  <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search members..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {/* Unassigned option */}
                      <CommandItem
                        value="__unassigned"
                        onSelect={() => {
                          setAssigneeId(null);
                          setAssigneeName("");
                          setAssigneeOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 size-4 ${
                            assigneeId === null && !assigneeName
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        Unassigned
                      </CommandItem>
                      {members.map((m) => (
                        <CommandItem
                          key={m.user.id}
                          value={m.user.name}
                          onSelect={() => {
                            setAssigneeId(m.user.id);
                            setAssigneeName(m.user.name);
                            setAssigneeOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 size-4 ${
                              assigneeId === m.user.id
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          <Avatar className="size-5 mr-2">
                            <AvatarImage src={m.user.image ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(m.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          {m.user.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="task-due-date">
              Due Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9"
              disabled={submitting}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}