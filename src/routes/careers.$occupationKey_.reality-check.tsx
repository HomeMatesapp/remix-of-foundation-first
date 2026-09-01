import { Link, createFileRoute } from "@tanstack/react-router";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_QUESTION_COPY } from "../content/reality-check-question-copy/architecture-tests";
import { getRealityCheckPackBinding } from "../features/career-discovery/coverage.functions";
import { SiteFooter, SiteHeader } from "../features/career-discovery/components/site-header";
import { RealityCheckFlow } from "../features/reality-check-experience/components/reality-check-flow";
import { careerQuestionCopyByOccupationKey } from "../features/reality-check-experience/content-schema";
import { RealityCheckOutcome } from "../features/reality-check-result/components/reality-check-outcome";
import { LocalRealitySection } from "../features/local-reality/components/local-reality-section";

/**
 * Increment 15 Reality Check question experience.
 *
 * Coverage is resolved by the SINGLE existing Increment 14 app-internal server
 * boundary, which delegates to the closed Increment 13 coverage layer. This
 * route never independently infers availability and never introduces a second
 * hashing, search or decision authority. Anything less than an exact
 * full-assessment coverage outcome fails closed.
 */
export const Route = createFileRoute("/careers/$occupationKey_/reality-check")({
  loader: ({ params }) =>
    getRealityCheckPackBinding({ data: { occupationKey: params.occupationKey } }),
  head: () => ({
    meta: [
      { title: "Reality Check questions — Clear Routes" },
      {
        name: "description",
        content:
          "Answer a short set of questions about your current starting point, one question at a time, and review every answer before you confirm it.",
      },
      { property: "og:title", content: "Reality Check questions — Clear Routes" },
      {
        property: "og:description",
        content:
          "Answer a short set of questions about your current starting point, one question at a time, and review every answer before you confirm it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealityCheckPage,
  errorComponent: RealityCheckUnavailable,
  notFoundComponent: RealityCheckUnavailable,
});

function RealityCheckUnavailable() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        This Reality Check is not available
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
        Clear Routes runs a Reality Check only for careers where it already holds a reviewed Career
        Pack covering the conditions attached to that career. This career is not one of them yet,
        and we would rather say so than ask you questions we cannot stand behind.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to career search
      </Link>
    </section>
  );
}

function RealityCheckPage() {
  const { occupationKey } = Route.useParams();
  const assessment = Route.useLoaderData();

  const occupation = ARCHITECTURE_TEST_OCCUPATIONS.find(
    (record) => record.occupationKey === occupationKey,
  );
  const candidateCopy = careerQuestionCopyByOccupationKey(
    ARCHITECTURE_TEST_QUESTION_COPY,
    occupationKey,
  );

  /*
   * The pack DOCUMENT and its coverage ref are established together server-side
   * from the exact recomputed content hash. This route never reselects a pack.
   */
  const bound =
    assessment.state === "assessment_available" && assessment.occupationKey === occupationKey
      ? assessment
      : undefined;

  /*
   * Presentation copy must belong to the SAME Career Pack the server bound.
   * A mismatched careerPackId means the copy layer and the canonical pack have
   * drifted, so the questionnaire fails closed rather than showing wording that
   * may not describe the questions actually being asked.
   */
  const copy =
    bound !== undefined &&
    candidateCopy !== undefined &&
    candidateCopy.careerPackId === bound.pack.careerPackId
      ? candidateCopy
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pt-10 pb-4 sm:px-8 sm:pt-14">
        {occupation !== undefined && copy !== undefined && bound !== undefined ? (
          /*
           * Exact questionnaire identity keys the component, so a change of
           * occupation or pack content hash mounts a FRESH controller and no
           * draft, answer, stage or confirmation state can cross that boundary.
           */
          <RealityCheckFlow
            key={`${bound.occupationKey}:${bound.pack.contentHash}`}
            occupationKey={occupationKey}
            occupationTitle={occupation.canonicalTitle}
            pack={bound.document}
            packRef={bound.pack}
            copy={copy}
            confirmLabel="Get my route judgement"
            renderConfirmed={({ confirmed, reviewItems, backToAnswers, startOver }) => (
              <>
                <RealityCheckOutcome
                  occupationKey={occupationKey}
                  occupationTitle={occupation.canonicalTitle}
                  confirmed={confirmed}
                  reviewItems={reviewItems}
                  onEditAnswers={backToAnswers}
                  onStartOver={startOver}
                />
                {/*
                 * Increment 17 Stage C sits AFTER the closed Increment 16
                 * result and outside its derivation. No canonical Local
                 * Reality snapshot boundary is connected in this build stage,
                 * so nothing local is fabricated here.
                 */}
                <LocalRealitySection
                  bindingKey={`${bound.occupationKey}:${bound.pack.contentHash}`}
                  localRequirements={bound.document.localRequirements}
                />
              </>
            )}
          />
        ) : (
          <RealityCheckUnavailable />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
