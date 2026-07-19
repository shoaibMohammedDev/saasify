"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { AppShell } from "@/components/layout/app-shell";
import { AuthPage } from "@/components/auth/auth-page";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionUser {
  id: number;
  name: string;
  email: string;
  image?: string | null;
}

export function AuthGate() {
  const { setAuth, isAuthenticated } = useAppStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user?.id) {
            setAuth(
              {
                id: session.user.id,
                name: session.user.name ?? "",
                email: session.user.email ?? "",
                image: session.user.image,
              },
              true
            );
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setChecking(false);
      }
    }
    checkSession();
  }, [setAuth]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <AppShell />;
  }

  return <AuthPage />;
}