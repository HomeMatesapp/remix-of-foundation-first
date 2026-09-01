import { Link } from "@tanstack/react-router";

/**
 * Calm Clear Routes wordmark. Deliberately no navigation items for features that
 * do not exist yet.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center px-5 py-5 sm:px-8">
        <Link
          to="/"
          className="rounded-sm text-base font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Clear Routes
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto max-w-3xl px-5 py-8 text-sm text-muted-foreground sm:px-8">
        Clear Routes helps you understand what a career really involves before you commit time or
        money.
      </div>
    </footer>
  );
}
