"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}