"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore, type OrgInfo } from "@/stores/app-store";
import { AppShell } from "@/components/layout/app-shell";
import { AuthPage } from "@/components/auth/auth-page";
import { LandingView } from "@/components/landing/landing-view";
import { WelcomeView } from "@/components/views/welcome-view";
import { AcceptInvitationView } from "@/components/invitations/accept-invitation-view";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGate() {
  const {
    setAuth,
    setOrganizations,
    setOrgsLoaded,
    selectOrg,
    isAuthenticated,
    orgsLoaded,
    organizations,
    setPendingInviteToken,
  } = useAppStore();

  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [checking, setChecking] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Store invite token so it persists across login
    if (inviteToken) {
      setPendingInviteToken(inviteToken);
    }

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
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

            // Fetch organizations after auth
            const orgsRes = await fetch("/api/organizations");
            if (orgsRes.ok) {
              const orgsData = await orgsRes.json();
              const orgs = orgsData.organizations as OrgInfo[];
              setOrganizations(orgs);

              // Auto-select first org
              if (orgs.length > 0) {
                selectOrg(orgs[0].id);
              }
            }
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setChecking(false);
        setOrgsLoaded(true);
      }
    }
    checkSession();
  }, [setAuth, setOrganizations, setOrgsLoaded, selectOrg, inviteToken, setPendingInviteToken]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  // If we have an invite token, show the AcceptInvitationView
  // It handles its own auth check internally (shows login prompt if not logged in)
  if (inviteToken) {
    return <AcceptInvitationView token={inviteToken} />;
  }

  if (!isAuthenticated) {
    // Show landing page by default, or auth form if user clicked "Get Started"
    if (showAuth) {
      return <AuthPage />;
    }
    return (
      <LandingView
        onGetStarted={() => setShowAuth(true)}
      />
    );
  }

  // If authenticated but no orgs, show WelcomeView directly (no shell)
  if (orgsLoaded && organizations.length === 0) {
    return <WelcomeView />;
  }

  // If authenticated and has orgs, show full app shell
  return <AppShell />;
}