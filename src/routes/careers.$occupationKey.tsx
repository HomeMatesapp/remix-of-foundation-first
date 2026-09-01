import { Link, createFileRoute } from "@tanstack/react-router";

import { ARCHITECTURE_TEST_PACKS } from "../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_CAREER_OVERVIEWS } from "../content/career-overviews/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../content/occupations/architecture-tests";
import { RoleOverview } from "../features/career-discovery/components/role-overview";
import { SiteFooter, SiteHeader } from "../features/career-discovery/components/site-header";
import { getRoleAssessmentAvailability } from "../features/career-discovery/coverage.functions";
import { buildRoleOverview } from "../features/career-discovery/view-model";

export const Route = createFileRoute("/careers/$occupationKey")({
  /**
   * Coverage comes from the CLOSED Increment 13 layer through an app-internal
   * server boundary, because its content-hash authority is server-side.
   */
  loader: ({ params }) =>
    getRoleAssessmentAvailability({ data: { occupationKey: params.occupationKey } }),
  head: () => ({
    meta: [
      { title: "Career overview — Clear Routes" },
      {
        name: "description",
        content:
          "An honest overview of a UK career: the day-to-day work, typical pay and hours, market context and the recognised ways in.",
      },
      { property: "og:title", content: "Career overview — Clear Routes" },
      {
        property: "og:description",
        content:
          "An honest overview of a UK career: the day-to-day work, typical pay and hours, market context and the recognised ways in.",
      },
    ],
  }),
  component: CareerRolePage,
  errorComponent: RoleNotAvailable,
  notFoundComponent: RoleNotAvailable,
});

function RoleNotAvailable() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        We do not have this career yet
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
        Clear Routes only shows careers it can describe honestly. Try searching for a specific job
        title instead.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to career search
      </Link>
    </div>
  );
}

function CareerRolePage() {
  const { occupationKey } = Route.useParams();
  const assessment = Route.useLoaderData();
  const result = buildRoleOverview({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    overviews: ARCHITECTURE_TEST_CAREER_OVERVIEWS,
    packs: ARCHITECTURE_TEST_PACKS,
    assessment,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pt-10 sm:px-8 sm:pt-14">
        {result.kind === "role_overview" ? <RoleOverview model={result} /> : <RoleNotAvailable />}
      </main>
      <SiteFooter />
    </div>
  );
}
