import { Server } from "socket.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgUserEntry {
  userId: number;
  userName: string;
  socketId: string;
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const PORT = 3005;

const io = new Server(PORT, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // Allow the Caddy gateway to proxy correctly
  path: "/socket.io",
});

// Track online users per org: Map<orgId, Map<userId, OrgUserEntry>>
const orgPresence = new Map<number, Map<number, OrgUserEntry>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPresenceForOrg(orgId: number): Map<number, OrgUserEntry> {
  let presence = orgPresence.get(orgId);
  if (!presence) {
    presence = new Map();
    orgPresence.set(orgId, presence);
  }
  return presence;
}

function broadcastPresence(orgId: number) {
  const presence = orgPresence.get(orgId);
  const onlineUsers = presence
    ? Array.from(presence.values()).map((u) => ({
        userId: u.userId,
        userName: u.userName,
      }))
    : [];

  io.to(`org:${orgId}`).emit("presence:update", { orgId, onlineUsers });
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log(`[realtime] socket connected: ${socket.id}`);

  // -------------------------------------------------------
  // Join an org room
  // -------------------------------------------------------
  socket.on("org:join", (data: { orgId: number; userId: number; userName: string }) => {
    const { orgId, userId, userName } = data;
    const room = `org:${orgId}`;

    // Leave any previous org rooms this socket might be in
    const rooms = Array.from(socket.rooms);
    for (const r of rooms) {
      if (r.startsWith("org:") && r !== room) {
        socket.leave(r);
        // Clean up old presence
        const oldOrgId = parseInt(r.replace("org:", ""), 10);
        if (!isNaN(oldOrgId)) {
          const oldPresence = orgPresence.get(oldOrgId);
          if (oldPresence) {
            // Remove entries for this socket
            for (const [uid, entry] of oldPresence) {
              if (entry.socketId === socket.id) {
                oldPresence.delete(uid);
              }
            }
            if (oldPresence.size === 0) orgPresence.delete(oldOrgId);
            broadcastPresence(oldOrgId);
          }
        }
      }
    }

    socket.join(room);

    // Track presence
    const presence = getPresenceForOrg(orgId);
    presence.set(userId, { userId, userName, socketId: socket.id });

    broadcastPresence(orgId);
    console.log(`[realtime] ${userName} (uid=${userId}) joined org:${orgId}`);
  });

  // -------------------------------------------------------
  // Leave an org room
  // -------------------------------------------------------
  socket.on("org:leave", (data: { orgId: number; userId: number }) => {
    const { orgId, userId } = data;
    const room = `org:${orgId}`;
    socket.leave(room);

    const presence = orgPresence.get(orgId);
    if (presence) {
      presence.delete(userId);
      if (presence.size === 0) orgPresence.delete(orgId);
    }

    broadcastPresence(orgId);
    console.log(`[realtime] uid=${userId} left org:${orgId}`);
  });

  // -------------------------------------------------------
  // Forward events to the org room
  // -------------------------------------------------------

  socket.on("task:updated", (data: { taskId: number; projectId: number; orgId: number; userId: number; changes: Record<string, unknown>; userName?: string }) => {
    const room = `org:${data.orgId}`;
    socket.to(room).emit("task:updated", data);
  });

  socket.on("task:created", (data: { task: Record<string, unknown>; projectId: number; orgId: number; userName?: string }) => {
    const room = `org:${data.orgId}`;
    socket.to(room).emit("task:created", data);
  });

  socket.on("task:deleted", (data: { taskId: number; projectId: number; orgId: number }) => {
    const room = `org:${data.orgId}`;
    socket.to(room).emit("task:deleted", data);
  });

  socket.on("activity:new", (data: { activity: Record<string, unknown>; orgId: number }) => {
    const room = `org:${data.orgId}`;
    socket.to(room).emit("activity:new", data);
  });

  socket.on("member:updated", (data: { orgId: number; userId: number; changes: Record<string, unknown> }) => {
    const room = `org:${data.orgId}`;
    socket.to(room).emit("member:updated", data);
  });

  // -------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------
  socket.on("disconnect", (reason) => {
    console.log(`[realtime] socket disconnected: ${socket.id} (${reason})`);

    // Clean up presence for all orgs this socket was in
    for (const [orgId, presence] of orgPresence) {
      for (const [uid, entry] of presence) {
        if (entry.socketId === socket.id) {
          presence.delete(uid);
        }
      }
      if (presence.size === 0) {
        orgPresence.delete(orgId);
      } else {
        broadcastPresence(orgId);
      }
    }
  });
});

console.log(`[realtime] Socket.IO server running on port ${PORT}`);