"use client";

import {
  ChevronRight,
  Search,
  Bell,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const viewLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  "project-detail": "Project",
  teams: "Teams",
  "team-detail": "Team",
  members: "Members",
  activity: "Activity",
  settings: "Settings",
  invitations: "Invitations",
};

export function TopBar() {
  const { user, currentView, organizations, selectedOrgId, toggleSidebar } =
    useAppStore();

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <ChevronRight className="size-5" />
      </Button>

      {/* Breadcrumb */}
      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => useAppStore.getState().setView("dashboard")}
            >
              {currentOrg?.name ?? "Home"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{viewLabels[currentView] ?? currentView}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Mobile: just show view name */}
      <span className="text-sm font-medium sm:hidden">
        {viewLabels[currentView] ?? currentView}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 gap-2 text-muted-foreground sm:flex"
          onClick={() => useAppStore.getState().setSearchOpen(true)}
        >
          <Search className="size-3.5" />
          <span className="text-xs">Search...</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
            ⌘K
          </Badge>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => useAppStore.getState().setSearchOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
        </Button>

        {/* User avatar (mobile) */}
        {user && (
          <Avatar className="h-7 w-7 sm:hidden">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {user.name[0]}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </header>
  );
}