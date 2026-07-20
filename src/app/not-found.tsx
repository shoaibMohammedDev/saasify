import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Page Not Found
        </h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}