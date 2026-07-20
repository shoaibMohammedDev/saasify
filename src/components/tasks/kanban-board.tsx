"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useAppStore } from "@/stores/app-store";
import { useOrgPermission } from "@/hooks/use-org-permission";
import { socketClient } from "@/lib/socket";
import { KanbanCard } from "./kanban-card";
import { CreateTaskDialog } from "./create-task-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import type { TaskListItem } from "./task-list";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  projectId: number;
  onTaskClick: (taskId: number) => void;
  onUpdated?: () => void;
}

interface ColumnDef {
  key: string;
  label: string;
  headerColor: string;
  dotColor: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef[] = [
  { key: "TODO", label: "To Do", headerColor: "border-t-muted-foreground/50", dotColor: "bg-muted-foreground" },
  { key: "IN_PROGRESS", label: "In Progress", headerColor: "border-t-blue-500", dotColor: "bg-blue-500" },
  { key: "IN_REVIEW", label: "In Review", headerColor: "border-t-amber-500", dotColor: "bg-amber-500" },
  { key: "DONE", label: "Done", headerColor: "border-t-emerald-500", dotColor: "bg-emerald-500" },
];

// ---------------------------------------------------------------------------
// Droppable Column wrapper
// ---------------------------------------------------------------------------

function DroppableColumn({
  columnKey,
  isOver,
  children,
}: {
  columnKey: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${columnKey}`,
    data: { type: "column", key: columnKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 rounded-lg p-1.5 transition-colors duration-200
        max-h-[calc(100vh-300px)] overflow-y-auto
        ${isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}
      `}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KanbanBoard({
  projectId,
  onTaskClick,
  onUpdated,
}: KanbanBoardProps) {
  const { user, selectedOrgId } = useAppStore();
  const canCreate = useOrgPermission("create_task");

  // ---- Data ---------------------------------------------------------------
  const [tasksByStatus, setTasksByStatus] = useState<
    Record<string, TaskListItem[]>
  >({});
  const [loading, setLoading] = useState(true);

  // ---- Drag state ---------------------------------------------------------
  const [activeTask, setActiveTask] = useState<TaskListItem | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // ---- Create-task dialog -------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [createForStatus, setCreateForStatus] = useState("TODO");

  // ---- Sensors (touch-friendly, 5px activation) ---------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // ---- Ref for reverting optimistic update --------------------------------
  const prevTasksRef = useRef<Record<string, TaskListItem[]> | null>(null);

  // =========================================================================
  // Fetch
  // =========================================================================

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", page: "1" });
      const res = await fetch(`/api/projects/${projectId}/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        const all: TaskListItem[] = data.tasks ?? [];
        const grouped: Record<string, TaskListItem[]> = {};
        for (const col of COLUMNS) {
          grouped[col.key] = all.filter((t) => t.status === col.key);
        }
        setTasksByStatus(grouped);
      } else {
        toast.error("Failed to load tasks");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // =========================================================================
  // Helpers
  // =========================================================================

  function findTaskById(id: number): TaskListItem | undefined {
    for (const tasks of Object.values(tasksByStatus)) {
      const found = tasks.find((t) => t.id === id);
      if (found) return found;
    }
    return undefined;
  }

  function getColumnFromOver(overId: string | number | null): string | null {
    if (overId === null) return null;
    const str = String(overId);
    if (str.startsWith("column-")) return str.replace("column-", "");
    const task = findTaskById(Number(overId));
    return task?.status ?? null;
  }

  // =========================================================================
  // Drag handlers
  // =========================================================================

  function handleDragStart(event: DragStartEvent) {
    const task = findTaskById(event.active.id as number);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumnId(getColumnFromOver(event.over?.id ?? null));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const targetStatus = getColumnFromOver(over?.id ?? null);
    setActiveTask(null);
    setOverColumnId(null);

    if (!targetStatus) return;

    const taskId = active.id as number;
    const sourceTask = findTaskById(taskId);
    if (!sourceTask || targetStatus === sourceTask.status) return;

    // ---- Optimistic update ----
    prevTasksRef.current = { ...tasksByStatus };
    setTasksByStatus((prev) => {
      const updated = { ...prev };
      updated[sourceTask.status] = (updated[sourceTask.status] ?? []).filter(
        (t) => t.id !== taskId
      );
      const movedTask = { ...sourceTask, status: targetStatus };
      updated[targetStatus] = [...(updated[targetStatus] ?? []), movedTask];
      return updated;
    });

    // ---- API call ----
    setUpdatingTaskId(taskId);
    try {
      fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((d) => {
              throw new Error(d.error || "Failed to update task");
            });
          }
          if (selectedOrgId && user) {
            socketClient.emitTaskUpdated({
              taskId,
              projectId,
              orgId: selectedOrgId,
              userId: user.id,
              changes: { status: targetStatus },
              userName: user.name,
            });
          }
          onUpdated?.();
        })
        .catch((err) => {
          toast.error(err.message);
          if (prevTasksRef.current) {
            setTasksByStatus(prevTasksRef.current);
            prevTasksRef.current = null;
          }
        })
        .finally(() => setUpdatingTaskId(null));
    } catch {
      toast.error("Something went wrong");
      if (prevTasksRef.current) {
        setTasksByStatus(prevTasksRef.current);
        prevTasksRef.current = null;
      }
      setUpdatingTaskId(null);
    }
  }

  // =========================================================================
  // Per-column "New Task" button
  // =========================================================================

  function openCreateForColumn(status: string) {
    setCreateForStatus(status);
    setCreateOpen(true);
  }

  // =========================================================================
  // Loading skeleton
  // =========================================================================

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <div className="flex gap-4" style={{ minWidth: "calc(280px * 4 + 48px)" }}>
          {COLUMNS.map((col) => (
            <div key={col.key} className="w-[280px] shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-l-2 border-l-muted-foreground/20 p-3 space-y-2"
                >
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                  <div className="flex items-center gap-2 pt-1">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2" style={{ minWidth: "calc(280px * 4 + 48px)" }}>
            {COLUMNS.map((col) => {
              const tasks = tasksByStatus[col.key] ?? [];
              const isOver = overColumnId === col.key && activeTask !== null;

              return (
                <div key={col.key} className="w-[280px] shrink-0 flex flex-col">
                  {/* Column header */}
                  <div
                    className={`border-t-2 ${col.headerColor} mb-3 flex items-center gap-2 pb-1`}
                  >
                    <span
                      className={`inline-block size-2 rounded-full ${col.dotColor}`}
                    />
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground tabular-nums">
                      {tasks.length}
                    </span>
                  </div>

                  {/* Droppable zone */}
                  <DroppableColumn columnKey={col.key} isOver={isOver}>
                    <SortableContext
                      items={tasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 min-h-[60px]">
                        {tasks.map((task) => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            onClick={onTaskClick}
                            isDragging={updatingTaskId === task.id}
                          />
                        ))}

                        {tasks.length === 0 && (
                          <div className="flex items-center justify-center py-8">
                            <p
                              className={`text-xs transition-colors duration-200 ${
                                isOver
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground/50"
                              }`}
                            >
                              {isOver ? "Drop here" : "Drop tasks here"}
                            </p>
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </DroppableColumn>

                  {/* Per-column add button */}
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => openCreateForColumn(col.key)}
                    >
                      <Plus className="size-3.5" />
                      New Task
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag overlay — elevated copy of dragged card */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-[260px]">
              <KanbanCard task={activeTask} onClick={() => {}} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateForStatus("TODO");
        }}
        projectId={projectId}
        defaultStatus={createForStatus}
        onCreated={() => {
          fetchTasks();
          onUpdated?.();
        }}
      />
    </>
  );
}