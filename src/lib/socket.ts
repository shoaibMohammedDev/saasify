"use client";

import { io, Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskUpdatedPayload {
  taskId: number;
  projectId: number;
  orgId: number;
  userId: number;
  changes: Record<string, unknown>;
  userName?: string;
}

export interface TaskCreatedPayload {
  task: {
    id: number;
    title: string;
    status: string;
    priority: string;
  };
  projectId: number;
  orgId: number;
  userName?: string;
}

export interface TaskDeletedPayload {
  taskId: number;
  projectId: number;
  orgId: number;
}

export interface ActivityNewPayload {
  activity: {
    id: number;
    action: string;
    description: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    userId: number;
    orgId: number;
    projectId: number | null;
    taskId: number | null;
    user: {
      id: number;
      name: string;
      email: string;
      image: string | null;
    };
    project: { id: number; name: string } | null;
    task: { id: number; title: string; status: string } | null;
  };
  orgId: number;
}

export interface MemberUpdatedPayload {
  orgId: number;
  userId: number;
  changes: Record<string, unknown>;
}

export interface PresenceUpdatePayload {
  orgId: number;
  onlineUsers: { userId: number; userName: string }[];
}

type EventCallback<T> = (payload: T) => void;

// ---------------------------------------------------------------------------
// Socket client singleton
// ---------------------------------------------------------------------------

class SocketClient {
  private socket: Socket | null = null;
  private joinedOrgId: number | null = null;

  // Callback registries
  private taskUpdateCallbacks: Set<EventCallback<TaskUpdatedPayload>> = new Set();
  private taskCreatedCallbacks: Set<EventCallback<TaskCreatedPayload>> = new Set();
  private taskDeletedCallbacks: Set<EventCallback<TaskDeletedPayload>> = new Set();
  private activityNewCallbacks: Set<EventCallback<ActivityNewPayload>> = new Set();
  private memberUpdatedCallbacks: Set<EventCallback<MemberUpdatedPayload>> = new Set();
  private presenceUpdateCallbacks: Set<EventCallback<PresenceUpdatePayload>> = new Set();

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  connect(userId: number, userName: string) {
    if (this.socket?.connected) return;

    this.socket = io("/?XTransformPort=3005", {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      // Reconnect automatically
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on("connect", () => {
      // Re-join the current org if we had one
      if (this.joinedOrgId !== null) {
        this.socket!.emit("org:join", {
          orgId: this.joinedOrgId,
          userId,
          userName,
        });
      }
    });

    this.socket.on("disconnect", () => {
      // Silently handle disconnect — reconnection is automatic
    });

    this.socket.on("connect_error", () => {
      // Silently handle connection errors — reconnection will retry
    });

    // Register event listeners
    this.socket.on("task:updated", (data: TaskUpdatedPayload) => {
      this.taskUpdateCallbacks.forEach((cb) => cb(data));
    });

    this.socket.on("task:created", (data: TaskCreatedPayload) => {
      this.taskCreatedCallbacks.forEach((cb) => cb(data));
    });

    this.socket.on("task:deleted", (data: TaskDeletedPayload) => {
      this.taskDeletedCallbacks.forEach((cb) => cb(data));
    });

    this.socket.on("activity:new", (data: ActivityNewPayload) => {
      this.activityNewCallbacks.forEach((cb) => cb(data));
    });

    this.socket.on("member:updated", (data: MemberUpdatedPayload) => {
      this.memberUpdatedCallbacks.forEach((cb) => cb(data));
    });

    this.socket.on("presence:update", (data: PresenceUpdatePayload) => {
      this.presenceUpdateCallbacks.forEach((cb) => cb(data));
    });
  }

  disconnect() {
    if (this.socket) {
      this.joinedOrgId = null;
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ---------------------------------------------------------------------------
  // Room management
  // ---------------------------------------------------------------------------

  joinOrg(orgId: number, userId: number, userName: string) {
    if (!this.socket) return;
    this.joinedOrgId = orgId;
    this.socket.emit("org:join", { orgId, userId, userName });
  }

  leaveOrg(orgId: number, userId: number) {
    if (!this.socket) return;
    this.socket.emit("org:leave", { orgId, userId });
    if (this.joinedOrgId === orgId) {
      this.joinedOrgId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Emit events (used by API routes after mutations)
  // ---------------------------------------------------------------------------

  emitTaskUpdated(data: TaskUpdatedPayload) {
    this.socket?.emit("task:updated", data);
  }

  emitTaskCreated(data: TaskCreatedPayload) {
    this.socket?.emit("task:created", data);
  }

  emitTaskDeleted(data: TaskDeletedPayload) {
    this.socket?.emit("task:deleted", data);
  }

  emitActivityNew(data: ActivityNewPayload) {
    this.socket?.emit("activity:new", data);
  }

  emitMemberUpdated(data: MemberUpdatedPayload) {
    this.socket?.emit("member:updated", data);
  }

  // ---------------------------------------------------------------------------
  // Subscribe to events
  // ---------------------------------------------------------------------------

  onTaskUpdate(callback: EventCallback<TaskUpdatedPayload>): () => void {
    this.taskUpdateCallbacks.add(callback);
    return () => this.taskUpdateCallbacks.delete(callback);
  }

  onTaskCreated(callback: EventCallback<TaskCreatedPayload>): () => void {
    this.taskCreatedCallbacks.add(callback);
    return () => this.taskCreatedCallbacks.delete(callback);
  }

  onTaskDeleted(callback: EventCallback<TaskDeletedPayload>): () => void {
    this.taskDeletedCallbacks.add(callback);
    return () => this.taskDeletedCallbacks.delete(callback);
  }

  onActivityNew(callback: EventCallback<ActivityNewPayload>): () => void {
    this.activityNewCallbacks.add(callback);
    return () => this.activityNewCallbacks.delete(callback);
  }

  onMemberUpdated(callback: EventCallback<MemberUpdatedPayload>): () => void {
    this.memberUpdatedCallbacks.add(callback);
    return () => this.memberUpdatedCallbacks.delete(callback);
  }

  onPresenceUpdate(callback: EventCallback<PresenceUpdatePayload>): () => void {
    this.presenceUpdateCallbacks.add(callback);
    return () => this.presenceUpdateCallbacks.delete(callback);
  }
}

// Export the singleton instance
export const socketClient = new SocketClient();