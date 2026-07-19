"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { Skeleton } from "@/components/ui/skeleton";

function AuthGateFallback() {
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

export default function Home() {
  return (
    <Suspense fallback={<AuthGateFallback />}>
      <AuthGate />
    </Suspense>
  );
}