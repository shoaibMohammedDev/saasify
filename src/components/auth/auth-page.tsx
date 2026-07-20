"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Zap, Rocket, ArrowRight } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthPage() {
  const { setAuth, setOrganizations, selectOrg } = useAppStore();

  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // ---- Shared: fetch session + set auth state ----
  async function finalizeAuth() {
    const sessionRes = await fetch("/api/auth/session");
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      if (session?.user?.id) {
        setAuth(
          {
            id: session.user.id,
            name: session.user.name ?? "",
            email: session.user.email ?? "",
            image: session.user.image,
          },
          true
        );

        // Fetch organizations
        const orgsRes = await fetch("/api/organizations");
        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          const orgs = orgsData.organizations;
          setOrganizations(orgs);
          if (orgs.length > 0) {
            selectOrg(orgs[0].id);
          }
        }

        return session.user;
      }
    }
    return null;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);

    try {
      const res = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (res?.error) {
        toast.error("Invalid email or password");
        return;
      }

      const user = await finalizeAuth();
      if (user) {
        toast.success(`Welcome back, ${user.name}`);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (regPassword !== regConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (regPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setRegisterLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Email already registered");
        } else if (data?.details) {
          const msgs = Object.values(data.details).flat();
          toast.error(msgs[0] as string);
        } else {
          toast.error(data.error || "Registration failed");
        }
        return;
      }

      // Auto-login after registration
      toast.success("Account created! Signing you in...");

      const loginRes = await signIn("credentials", {
        email: regEmail,
        password: regPassword,
        redirect: false,
      });

      if (loginRes?.ok) {
        await finalizeAuth();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);

    try {
      const res = await fetch("/api/auth/demo-login", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Demo is not available right now");
        return;
      }

      // Mark demo mode in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("saasify_demo_mode", "true");
      }

      const user = await finalizeAuth();
      if (user) {
        toast.success("Welcome to the Demo!");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="mb-2 inline-flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SaaSify</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Multi-Tenant SaaS Workspace Platform
        </p>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign In</TabsTrigger>
          <TabsTrigger value="register">Create Account</TabsTrigger>
        </TabsList>

        {/* Sign In */}
        <TabsContent value="login">
          <Card>
            <form onSubmit={handleLogin}>
              <CardHeader className="pb-4">
                <CardDescription>
                  Sign in to your workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={loginLoading || demoLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={loginLoading || demoLoading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginLoading || demoLoading}
                >
                  {loginLoading && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Sign In
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Register */}
        <TabsContent value="register">
          <Card>
            <form onSubmit={handleRegister}>
              <CardHeader className="pb-4">
                <CardDescription>
                  Create your account to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input
                    id="reg-name"
                    placeholder="John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    disabled={registerLoading || demoLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    disabled={registerLoading || demoLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={registerLoading || demoLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">Confirm Password</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    placeholder="Repeat your password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    required
                    disabled={registerLoading || demoLoading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerLoading || demoLoading}
                >
                  {registerLoading && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Create Account
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Demo Card — prominent call-to-action below the auth form */}
      <button
        type="button"
        onClick={handleDemo}
        disabled={demoLoading || loginLoading || registerLoading}
        className="mt-4 w-full max-w-[400px] group relative overflow-hidden rounded-xl border border-dashed border-muted-foreground/30 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-left transition-all hover:border-amber-400/60 hover:shadow-md dark:from-amber-950/20 dark:to-orange-950/20"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Rocket className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {demoLoading ? "Loading demo..." : "Try the Demo"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Explore with pre-loaded data — no sign-up required
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </div>
        {demoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </button>
    </div>
  );
}