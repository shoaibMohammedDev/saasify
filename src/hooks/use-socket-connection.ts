"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { socketClient } from "@/lib/socket";

/**
 * Hook that connects the socket on auth, disconnects on logout,
 * and automatically joins/leaves the org room based on selectedOrgId.
 * Place this once at the app shell level.
 */
export function useSocketConnection() {
  const { isAuthenticated, user, selectedOrgId } = useAppStore();
  const prevOrgRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      socketClient.disconnect();
      prevOrgRef.current = null;
      return;
    }

    // Connect on auth
    socketClient.connect(user.id, user.name);

    return () => {
      socketClient.disconnect();
      prevOrgRef.current = null;
    };
  }, [isAuthenticated, user]);

  // Auto-join/leave org room when selectedOrgId changes
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Leave previous org
    if (prevOrgRef.current !== null && prevOrgRef.current !== selectedOrgId) {
      socketClient.leaveOrg(prevOrgRef.current, user.id);
    }

    // Join new org
    if (selectedOrgId !== null) {
      socketClient.joinOrg(selectedOrgId, user.id, user.name);
      prevOrgRef.current = selectedOrgId;
    }
  }, [isAuthenticated, user, selectedOrgId]);
}