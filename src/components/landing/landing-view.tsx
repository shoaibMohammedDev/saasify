"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap, ArrowRight, Shield, FolderKanban, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingViewProps {
  onGetStarted: () => void;
}

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const features = [
  {
    icon: Shield,
    title: "Multi-Tenant Architecture",
    description:
      "Isolated workspaces for every organization with role-based access control",
  },
  {
    icon: FolderKanban,
    title: "Project Management",
    description:
      "Organize work with projects, tasks, and Kanban boards",
  },
  {
    icon: Radio,
    title: "Real-Time Collaboration",
    description:
      "See changes instantly with live updates and activity feeds",
  },
];

const techStack = [
  "Next.js",
  "TypeScript",
  "PostgreSQL",
  "Prisma",
  "Tailwind CSS",
  "Socket.IO",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingView({ onGetStarted }: LandingViewProps) {
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleDemo() {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo-login", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Demo is not available right now");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("saasify_demo_mode", "true");
      }
      // Reload to pick up the session
      window.location.href = "/";
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ---------------------------------------------------------------- */}
      {/* Hero */}
      {/* ---------------------------------------------------------------- */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]"
        />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-24 text-center sm:pt-32 md:pt-40">
          {/* Logo */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <Zap className="size-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium">SaaSify</span>
          </div>

          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            The modern workspace for teams that ship
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Manage projects, collaborate in real-time, and organize your team —
            all in one beautiful platform.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 px-8"
              onClick={onGetStarted}
            >
              Get Started
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 px-8"
              onClick={handleDemo}
              disabled={demoLoading}
            >
              {demoLoading && <Loader2 className="size-4 animate-spin" />}
              Try Demo
            </Button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Features Grid */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card
              key={f.title}
              className="border-transparent transition-colors hover:border-border"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="size-4.5 text-primary" />
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-0">
                <CardDescription className="text-sm leading-relaxed">
                  {f.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Tech Stack */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Built With
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {techStack.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-full border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer */}
      {/* ---------------------------------------------------------------- */}
      <footer className="mt-auto border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>&copy; 2025 SaaSify &middot; Built as a portfolio project</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="/"
              className="transition-colors hover:text-foreground"
            >
              View Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}