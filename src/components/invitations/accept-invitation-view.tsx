"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Zap, ArrowRight } from "lucide-react";

import { useAppStore, type OrgInfo } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface InvitationDetails {
  email: string;
  role: string;
  orgId: number;
  orgName: string;
  orgSlug: string;
  expiresAt: string;
}

type Status = "loading" | "valid" | "expired" | "not_found" | "accepted" | "error";

interface AcceptInvitationViewProps {
  token: string;
}

export function AcceptInvitationView({ token }: AcceptInvitationViewProps) {
  const { user, isAuthenticated, setOrganizations, selectOrg, setView } =
    useAppStore();

  const [status, setStatus] = useState<Status>("loading");
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Fetch invitation details on mount
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();

        if (res.status === 404) {
          setStatus("not_found");
        } else if (res.status === 410) {
          setStatus(data.error?.includes("expired") ? "expired" : "accepted");
        } else if (res.ok) {
          setInvitation(data.invitation);
          setStatus("valid");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }

    fetchInvitation();
  }, [token]);

  async function handleAccept() {
    if (!invitation) return;
    setAccepting(true);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          toast.error(data.error || "Invitation is no longer valid");
          setStatus(
            data.error?.includes("expired") ? "expired" : "accepted"
          );
        } else {
          toast.error(data.error || "Failed to accept invitation");
        }
        return;
      }

      toast.success(`Welcome to ${data.orgName}!`);

      // Refresh orgs and switch to the new org
      const orgsRes = await fetch("/api/organizations");
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        const orgs = orgsData.organizations as OrgInfo[];
        setOrganizations(orgs);
        selectOrg(data.orgId);
        setView("dashboard");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  // Error states
  function renderError() {
    const config = {
      not_found: {
        icon: XCircle,
        title: "Invitation Not Found",
        desc: "This invitation link doesn't exist or may have been deleted.",
      },
      expired: {
        icon: XCircle,
        title: "Invitation Expired",
        desc: "This invitation has expired. Please ask the sender for a new one.",
      },
      accepted: {
        icon: CheckCircle2,
        title: "Already Accepted",
        desc: "This invitation has already been used. You should already have access.",
      },
      error: {
        icon: XCircle,
        title: "Something Went Wrong",
        desc: "We couldn't load this invitation. Please try again later.",
      },
    }[status];

    if (!config) return null;
    const Icon = config.icon;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <div className="mb-4 inline-flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">SaaSify</span>
        </div>
        <Card className="w-full max-w-[400px]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <Icon className="size-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">{config.title}</CardTitle>
            <CardDescription>{config.desc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <div className="mb-4 inline-flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">SaaSify</span>
        </div>
        <Card className="w-full max-w-[400px]">
          <CardHeader className="text-center">
            <Skeleton className="mx-auto mb-2 size-10 rounded-full" />
            <Skeleton className="mx-auto h-5 w-48" />
            <Skeleton className="mx-auto mt-1 h-4 w-64" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status !== "valid" || !invitation) {
    return renderError();
  }

  // Valid invitation — show accept UI
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="mb-6 inline-flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="size-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">SaaSify</span>
      </div>

      <Card className="w-full max-w-[400px]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <CardTitle className="text-lg">You&apos;re Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a workspace on SaaSify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Org details */}
          <div className="rounded-lg border p-4 text-center">
            <p className="text-lg font-semibold">{invitation.orgName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Invited as{" "}
              <span className="font-medium capitalize">
                {invitation.role.toLowerCase()}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sent to <span className="font-medium">{invitation.email}</span>
            </p>
          </div>

          {!isAuthenticated ? (
            <p className="text-center text-sm text-muted-foreground">
              Sign in or create an account to accept this invitation.
            </p>
          ) : user?.email?.toLowerCase() !== invitation.email?.toLowerCase() ? (
            <p className="text-center text-sm text-destructive">
              This invitation was sent to{" "}
              <strong>{invitation.email}</strong>, but you&apos;re signed in
              as <strong>{user.email}</strong>. Please sign in with the correct
              account.
            </p>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Accept Invitation
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}