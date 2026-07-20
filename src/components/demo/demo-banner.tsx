"use client";

import { useEffect, useState } from "react";
import { X, Info } from "lucide-react";

const DEMO_STORAGE_KEY = "saasify_demo_dismissed";

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  // Read localStorage on mount (useEffect for client-only access)
  useEffect(() => {
    const isDemo = localStorage.getItem("saasify_demo_mode") === "true";
    const dismissed = localStorage.getItem(DEMO_STORAGE_KEY) === "true";
    // Defer to avoid synchronous setState in effect
    const shouldShow = isDemo && !dismissed;
    if (shouldShow) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative flex items-center gap-3 bg-amber-50 px-4 py-2.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <Info className="size-4 shrink-0" />
      <p className="flex-1 text-sm font-medium">
        <span className="mr-1">Demo Mode</span>
        <span className="font-normal">
          — You&apos;re exploring with demo data. Changes are visible to everyone.
        </span>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 transition-colors hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
        aria-label="Dismiss demo banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}