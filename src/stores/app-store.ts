"use client";

import { create } from "zustand";

interface User {
  id: number;
  name: string;
  email: string;
  image?: string | null;
}

export interface OrgInfo {
  id: number;
  name: string;
  slug: string;
  role: string;
  logo?: string | null;
  memberCount?: number;
  projectCount?: number;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  user: User | null;

  // Navigation
  currentView: string;
  selectedOrgId: number | null;
  selectedProjectId: number | null;
  selectedTeamId: number | null;
  selectedTaskId: number | null;

  // UI
  sidebarOpen: boolean;
  searchOpen: boolean;

  // Org cache
  organizations: OrgInfo[];
  orgsLoaded: boolean;

  // Invitation flow
  pendingInviteToken: string | null;

  // Actions
  setAuth: (user: User | null, isAuthenticated: boolean) => void;
  clearAuth: () => void;
  setView: (view: string) => void;
  selectOrg: (orgId: number) => void;
  selectProject: (projectId: number) => void;
  selectTeam: (teamId: number) => void;
  selectTask: (taskId: number) => void;
  setOrganizations: (orgs: OrgInfo[]) => void;
  setOrgsLoaded: (loaded: boolean) => void;
  setPendingInviteToken: (token: string | null) => void;
  toggleSidebar: () => void;
  setSearchOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  isAuthenticated: false,
  user: null,

  // Navigation
  currentView: "dashboard",
  selectedOrgId: null,
  selectedProjectId: null,
  selectedTeamId: null,
  selectedTaskId: null,

  // UI
  sidebarOpen: false,
  searchOpen: false,

  // Org cache
  organizations: [],
  orgsLoaded: false,

  // Invitation flow
  pendingInviteToken: null,

  // Actions
  setAuth: (user, isAuthenticated) =>
    set({ user, isAuthenticated, currentView: "dashboard" }),

  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      currentView: "dashboard",
      selectedOrgId: null,
      selectedProjectId: null,
      selectedTeamId: null,
      selectedTaskId: null,
      organizations: [],
      orgsLoaded: false,
    }),

  setView: (view) => set({ currentView: view }),

  selectOrg: (orgId) =>
    set({ selectedOrgId: orgId, currentView: "dashboard" }),

  selectProject: (projectId) =>
    set({ selectedProjectId: projectId, currentView: "project-detail" }),

  selectTeam: (teamId) =>
    set({ selectedTeamId: teamId, currentView: "team-detail" }),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setOrganizations: (organizations) => set({ organizations }),

  setOrgsLoaded: (orgsLoaded) => set({ orgsLoaded }),

  setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));