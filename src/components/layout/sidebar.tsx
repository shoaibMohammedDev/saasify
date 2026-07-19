"use client";

import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCog,
  Activity,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "teams", label: "Teams", icon: Users },
  { id: "members", label: "Members", icon: UserCog },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, currentView, setView, clearAuth, sidebarOpen, toggleSidebar } =
    useAppStore();

  return (
    <div className="flex h-full flex-col">
      {/* Org Switcher */}
      <div className="p-3">
        <OrganizationSwitcher />
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "relative h-9 justify-start gap-3 px-3 text-sm font-normal",
                  isActive &&
                    "bg-accent text-accent-foreground font-medium"
                )}
                onClick={() => {
                  setView(item.id);
                  onNavigate?.();
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Bottom: User + Actions */}
      <div className="p-3">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 w-full justify-start gap-2 text-sm font-normal"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="text-xs">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium leading-tight">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2 text-sm font-normal text-muted-foreground hover:text-destructive"
          onClick={() => {
            clearAuth();
            signOut({ callbackUrl: "/" });
          }}
        >
          <LogOut className="size-4" />
          Log Out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:border-r bg-card">
        <div className="flex h-14 items-center px-4">
          <span className="text-lg font-bold tracking-tight">SaaSify</span>
        </div>
        <Separator />
        <NavContent />
      </aside>

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={toggleSidebar}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center px-4">
              <span className="text-lg font-bold tracking-tight">SaaSify</span>
            </div>
            <Separator />
            <NavContent onNavigate={toggleSidebar} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}