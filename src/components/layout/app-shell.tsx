"use client";

import { useAppStore } from "@/stores/app-store";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { Footer } from "./footer";

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { currentView } = useAppStore();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {/* Placeholder content for each view */}
            {children ?? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">
                  {currentView === "dashboard"
                    ? "Dashboard content will appear here"
                    : `${currentView} view — coming soon`}
                </p>
              </div>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}