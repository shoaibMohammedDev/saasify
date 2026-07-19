"use client";

import { useAppStore } from "@/stores/app-store";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { Footer } from "./footer";
import { WelcomeView } from "@/components/views/welcome-view";
import { SettingsView } from "@/components/views/settings-view";
import { MembersView } from "@/components/views/members-view";
import { TeamsView } from "@/components/views/teams-view";
import { TeamDetailView } from "@/components/views/team-detail-view";
import { ProjectsView } from "@/components/views/projects-view";
import { ProjectDetailView } from "@/components/views/project-detail-view";
import { ActivityView } from "@/components/views/activity-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { SearchDialog } from "@/components/search/search-dialog";

export function AppShell() {
  const { currentView, selectedOrgId, organizations } = useAppStore();

  // If user has no orgs (e.g. deleted all orgs), show welcome
  const hasOrgs = organizations.length > 0 && selectedOrgId !== null;

  // Render the appropriate view content
  function renderView() {
    if (!hasOrgs) {
      return <WelcomeView />;
    }

    switch (currentView) {
      case "settings":
        return <SettingsView />;
      case "members":
        return <MembersView />;
      case "projects":
        return <ProjectsView />;
      case "project-detail":
        return <ProjectDetailView />;
      case "teams":
        return <TeamsView />;
      case "team-detail":
        return <TeamDetailView />;
      case "activity":
        return <ActivityView />;
      case "dashboard":
        return <DashboardView />;
      default:
        return (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">
              {`${currentView} view — coming soon`}
            </p>
          </div>
        );
    }
  }

  // When no orgs, show minimal layout with welcome
  if (!hasOrgs) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopBar />
        <main className="flex flex-1 flex-col overflow-auto p-4 md:p-6">
          <WelcomeView />
        </main>
        <Footer />
        <SearchDialog />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {renderView()}
          </main>
          <Footer />
        </div>
      </div>
      <SearchDialog />
    </div>
  );
}