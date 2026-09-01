import { createFileRoute } from "@tanstack/react-router";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../content/occupations/architecture-tests";
import { DiscoverySearch } from "../features/career-discovery/components/discovery-search";
import { SiteFooter, SiteHeader } from "../features/career-discovery/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clear Routes — understand a career before you commit" },
      {
        name: "description",
        content:
          "Explore sourced career overviews and understand the work, pay, hours and recognised routes before assessment.",
      },
      { property: "og:title", content: "Clear Routes — understand a career before you commit" },
      {
        property: "og:description",
        content:
          "Explore sourced career overviews and understand the work, pay, hours and recognised routes before assessment.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pt-14 sm:px-8 sm:pt-20">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2.6rem]">
          Understand what a career really involves, before you commit time or money.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Clear Routes shows the honest picture of a role — the work, the pay, the hours and the
          recognised ways in — so your next decision is an informed one.
        </p>
        <DiscoverySearch universe={ARCHITECTURE_TEST_OCCUPATIONS} />
      </main>
      <SiteFooter />
    </div>
  );
}
