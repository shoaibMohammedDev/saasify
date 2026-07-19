export function Footer() {
  return (
    <footer className="border-t py-4 text-center text-xs text-muted-foreground">
      <p>
        © {new Date().getFullYear()} SaaSify · Built with Next.js, Prisma &
        Supabase
      </p>
    </footer>
  );
}