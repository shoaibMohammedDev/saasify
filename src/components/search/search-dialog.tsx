"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  Search,
  FolderKanban,
  CheckSquare,
  Users,
  User,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchProject {
  id: number;
  name: string;
  status: string;
  taskCount: number;
}

interface SearchTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  projectId: number;
  projectName: string;
}

interface SearchTeam {
  id: number;
  name: string;
  memberCount: number;
}

interface SearchMember {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SearchResult {
  projects: SearchProject[];
  tasks: SearchTask[];
  teams: SearchTeam[];
  members: SearchMember[];
}

interface FlatItem {
  type: "project" | "task" | "team" | "member";
  id: number;
  label: string;
  sublabel: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECENT_KEY = "saasify_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentSearches().filter((s) => s !== query);
    existing.unshift(query);
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(existing.slice(0, MAX_RECENT))
    );
  } catch {
    // ignore
  }
}

const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const roleVariant: Record<string, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  MEMBER: "outline",
};

// ---------------------------------------------------------------------------
// Flat result list for keyboard navigation
// ---------------------------------------------------------------------------

function flattenResults(results: SearchResult): FlatItem[] {
  const items: FlatItem[] = [];
  for (const p of results.projects) {
    items.push({ type: "project", id: p.id, label: p.name, sublabel: `${statusLabels[p.status] ?? p.status} · ${p.taskCount} task${p.taskCount !== 1 ? "s" : ""}` });
  }
  for (const t of results.tasks) {
    items.push({ type: "task", id: t.id, label: t.title, sublabel: t.projectName });
  }
  for (const tm of results.teams) {
    items.push({ type: "team", id: tm.id, label: tm.name, sublabel: `${tm.memberCount} member${tm.memberCount !== 1 ? "s" : ""}` });
  }
  for (const m of results.members) {
    items.push({ type: "member", id: m.id, label: m.name, sublabel: `${m.email} · ${statusLabels[m.role] ?? m.role}` });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
      <Icon className="size-3.5 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <Badge
        variant="secondary"
        className="h-4 px-1 text-[10px] tabular-nums"
      >
        {count}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  selected,
  rightElement,
  onClick,
  onMouseEnter,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  sublabel: string;
  selected: boolean;
  rightElement?: React.ReactNode;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      data-selected={selected || undefined}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          iconBg
        )}
      >
        <Icon className={cn("size-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sublabel}</p>
      </div>
      {rightElement}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main SearchDialog
// ---------------------------------------------------------------------------

export function SearchDialog() {
  const {
    searchOpen,
    setSearchOpen,
    selectedOrgId,
    selectProject,
    selectTeam,
    setView,
    isAuthenticated,
  } = useAppStore();

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handleGlobalKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isAuthenticated) setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, [isAuthenticated, setSearchOpen]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load recent searches when dialog opens
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setResults(null);
      setLoading(false);
      setSelectedIndex(-1);
      setRecentSearches(getRecentSearches());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  // ---- Search function ----
  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (!selectedOrgId || searchQuery.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/organizations/${selectedOrgId}/search?q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal }
        );
        if (res.ok && !controller.signal.aborted) {
          const data: SearchResult = await res.json();
          setResults(data);
          setSelectedIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) setResults(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [selectedOrgId]
  );

  // ---- Debounced input handler ----
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => doSearch(value), 200);
    },
    [doSearch]
  );

  // ---- Navigate to result ----
  function navigateTo(item: FlatItem) {
    setSearchOpen(false);
    switch (item.type) {
      case "project":
        selectProject(item.id);
        break;
      case "task": {
        useAppStore.getState().selectTask(item.id);
        const match = results?.tasks.find((t) => t.id === item.id);
        if (match) selectProject(match.projectId);
        else setView("projects");
        break;
      }
      case "team":
        selectTeam(item.id);
        break;
      case "member":
        setView("members");
        break;
    }
  }

  // ---- Keyboard navigation ----
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const flat = results ? flattenResults(results) : [];
    const total = flat.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i < total - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : total - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < total) {
        saveRecentSearch(query);
        navigateTo(flat[selectedIndex]);
      } else if (query.length >= 2) {
        saveRecentSearch(query);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearchOpen(false);
    }
  }

  // ---- Scroll selected item into view ----
  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = listRef.current?.querySelector("[data-selected]");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ---- Derived ----
  const hasAny =
    results &&
    (results.projects.length > 0 ||
      results.tasks.length > 0 ||
      results.teams.length > 0 ||
      results.members.length > 0);

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent
        className="flex max-h-[80vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-2xl sm:max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Input bar */}
        <div className="flex items-center border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, tasks, teams, members..."
            className="h-12 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
          />
          {loading && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1">
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {/* ---- No query: recent searches ---- */}
            {query.length < 2 && !loading && (
              <div className="py-4">
                {recentSearches.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 px-3 pb-1.5">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent
                      </h3>
                    </div>
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                        onClick={() => {
                          setQuery(term);
                          doSearch(term);
                          saveRecentSearch(term);
                        }}
                      >
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{term}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-12">
                    <Search className="mb-3 size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Start typing to search...
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Search across projects, tasks, teams, and members
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ---- Loading ---- */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}

            {/* ---- No results ---- */}
            {!loading && query.length >= 2 && !hasAny && (
              <div className="flex flex-col items-center py-12">
                <Search className="mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No results found for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {/* ---- Grouped results ---- */}
            {!loading && hasAny && results && (
              <div className="py-2">
                {/* Projects */}
                {results.projects.length > 0 && (
                  <>
                    <SectionHeader
                      icon={FolderKanban}
                      label="Projects"
                      count={results.projects.length}
                    />
                    {results.projects.map((p, i) => (
                      <ResultRow
                        key={`p-${p.id}`}
                        icon={FolderKanban}
                        iconBg="bg-primary/10"
                        iconColor="text-primary"
                        label={p.name}
                        sublabel={`${statusLabels[p.status] ?? p.status} · ${p.taskCount} task${p.taskCount !== 1 ? "s" : ""}`}
                        selected={selectedIndex === flatIndex("project", 0, i)}
                        onClick={() => {
                          saveRecentSearch(query);
                          navigateTo({ type: "project", id: p.id, label: p.name, sublabel: "" });
                        }}
                        onMouseEnter={() =>
                          setSelectedIndex(flatIndex("project", 0, i))
                        }
                      />
                    ))}
                  </>
                )}

                {/* Tasks */}
                {results.tasks.length > 0 && (
                  <>
                    <SectionHeader
                      icon={CheckSquare}
                      label="Tasks"
                      count={results.tasks.length}
                    />
                    {results.tasks.map((t, i) => (
                      <ResultRow
                        key={`t-${t.id}`}
                        icon={CheckSquare}
                        iconBg="bg-sky-500/10"
                        iconColor="text-sky-500"
                        label={t.title}
                        sublabel={t.projectName}
                        selected={selectedIndex === flatIndex("task", results.projects.length, i)}
                        onClick={() => {
                          saveRecentSearch(query);
                          navigateTo({ type: "task", id: t.id, label: t.title, sublabel: t.projectName });
                        }}
                        onMouseEnter={() =>
                          setSelectedIndex(flatIndex("task", results.projects.length, i))
                        }
                      />
                    ))}
                  </>
                )}

                {/* Teams */}
                {results.teams.length > 0 && (
                  <>
                    <SectionHeader
                      icon={Users}
                      label="Teams"
                      count={results.teams.length}
                    />
                    {results.teams.map((t, i) => (
                      <ResultRow
                        key={`tm-${t.id}`}
                        icon={Users}
                        iconBg="bg-violet-500/10"
                        iconColor="text-violet-500"
                        label={t.name}
                        sublabel={`${t.memberCount} member${t.memberCount !== 1 ? "s" : ""}`}
                        selected={selectedIndex === flatIndex("team", results.projects.length + results.tasks.length, i)}
                        onClick={() => {
                          saveRecentSearch(query);
                          navigateTo({ type: "team", id: t.id, label: t.name, sublabel: "" });
                        }}
                        onMouseEnter={() =>
                          setSelectedIndex(flatIndex("team", results.projects.length + results.tasks.length, i))
                        }
                      />
                    ))}
                  </>
                )}

                {/* Members */}
                {results.members.length > 0 && (
                  <>
                    <SectionHeader
                      icon={User}
                      label="Members"
                      count={results.members.length}
                    />
                    {results.members.map((m, i) => (
                      <ResultRow
                        key={`m-${m.id}`}
                        icon={User}
                        iconBg="bg-amber-500/10"
                        iconColor="text-amber-500"
                        label={m.name}
                        sublabel={m.email}
                        selected={selectedIndex === flatIndex("member", results.projects.length + results.tasks.length + results.teams.length, i)}
                        rightElement={
                          <Badge
                            variant={roleVariant[m.role] ?? "outline"}
                            className="mr-1 shrink-0 text-[10px]"
                          >
                            {statusLabels[m.role] ?? m.role}
                          </Badge>
                        }
                        onClick={() => {
                          saveRecentSearch(query);
                          navigateTo({ type: "member", id: m.id, label: m.name, sublabel: m.email });
                        }}
                        onMouseEnter={() =>
                          setSelectedIndex(flatIndex("member", results.projects.length + results.tasks.length + results.teams.length, i))
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Compute flat index from group/position
// ---------------------------------------------------------------------------

function flatIndex(
  _type: string,
  offset: number,
  localIndex: number
): number {
  void _type;
  return offset + localIndex;
}