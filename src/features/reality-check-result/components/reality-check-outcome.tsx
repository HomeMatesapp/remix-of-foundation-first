import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";
import type { ConfirmedAnswerSet, ReviewItem } from "../../reality-check-experience/flow";
import { careerResultCopyByOccupationKey, resultCopyMatchesPackRef } from "../content-schema";
import { evaluateRealityCheckAnswers } from "../evaluation.functions";
import type { RealityCheckEvaluationOutcome } from "../result-types";
import {
  LOCAL_ACCESS_NOT_ASSESSED,
  buildResultViewModel,
  type CheckItem,
  type RequirementItem,
  type RouteItem,
} from "../view-model";

/**
 * Increment 16 — the participant Reality Check result experience.
 *
 * The judgement, the routes, their order, the requirement states, barriers,
 * unresolved checks and triggered actions are all produced by the closed
 * Decision Engine behind the single server boundary. This component renders them
 * with reviewed copy and decides nothing: it never names a strongest route the
 * engine did not separate, and it never treats canonical key order as priority.
 *
 * The RESULT itself is not saved anywhere. Local access is not assessed here.
 */

const QUIET =
  "rounded-md border border-border px-5 py-3 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const CARD = "rounded-lg border border-border bg-card p-5";
const H2 = "mt-10 text-xl font-semibold tracking-tight text-foreground";
const H3 = "text-base font-semibold text-foreground";
const BODY = "text-[0.95rem] leading-relaxed text-muted-foreground";

/**
 * The RESULT is never persisted; Increment 15 does keep the questionnaire in
 * this browser tab for the current browser session. Nothing is account-backed.
 */
const SESSION_NOTE =
  "This result is not saved anywhere. Your answers stay in this browser tab for this browser session, so you can go back and change them, and they are not stored to any account.";

function statusLabel(item: RequirementItem): string {
  if (item.status === "met") return "Met";
  if (item.status === "not_met") return "Not met yet";
  if (item.status === "not_applicable") return "Does not apply to you";
  return "Needs checking";
}

/**
 * Tri-state wording. `null` is always "needs checking", never "no".
 *
 * A `true` here is the closed engine's BLOCKING/mandatory judgement for this
 * purpose. It does not mean nothing is left to do: non-blocking conditions can
 * still be outstanding, so the wording claims only that no blocking issue was
 * identified.
 */
function positionLabel(value: boolean | null, dimension: "entry" | "practical"): string {
  if (value === true) return "No blocking issue identified on your answers";
  /* A false is a blocking issue in THIS dimension, not permanent impossibility. */
  if (value === false)
    return dimension === "entry"
      ? "A blocking formal entry issue was identified on your answers"
      : "A blocking practical issue was identified on your answers";
  return "Needs checking";
}

function RequirementList({ items }: { items: readonly RequirementItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 space-y-3">
      {items.map((item) => (
        <li key={item.requirementKey} className="text-[0.95rem] leading-relaxed">
          <p className="font-medium text-foreground">
            {item.label} — <span className="font-normal">{statusLabel(item)}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{item.statement}</p>
          {item.severity !== "mandatory" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              This one is not a hard requirement; it affects how workable the route is for you.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The three distinct positions for a top route, mapped honestly from engine truth. */
function RoutePositions({ route }: { route: RouteItem }) {
  return (
    <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
      <div>
        <dt className="text-sm font-semibold text-foreground">Formal entry</dt>
        <dd className={`mt-1 ${BODY}`}>
          {route.eligibility === true && route.met.length === 0
            ? "This pack identifies no formal entry blocker for this route on your answers."
            : positionLabel(route.eligibility, "entry")}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-foreground">Practical fit</dt>
        <dd className={`mt-1 ${BODY}`}>{positionLabel(route.practicalFit, "practical")}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-foreground">Local access</dt>
        <dd className={`mt-1 ${BODY}`}>Not assessed yet. {LOCAL_ACCESS_NOT_ASSESSED}</dd>
      </div>
    </dl>
  );
}

function NextSteps({ route }: { route: RouteItem }) {
  if (route.nextActions.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-semibold text-foreground">
        {route.soleNextAction
          ? "The one next step that follows for this route"
          : "Next steps for this route, in no order of priority"}
      </p>
      <ul className="mt-2 space-y-2">
        {route.nextActions.map((action) => (
          <li key={action.actionKey} className="text-[0.95rem] leading-relaxed">
            <span className="font-medium text-foreground">{action.label}</span>{" "}
            <span className="text-muted-foreground">{action.guidance}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tri-state barrier wording. `false` and `null` never sound hard-blocking. */
function barrierNote(blocking: boolean | null): string {
  if (blocking === true) return " On your answers, this is standing in the way at the moment.";
  if (blocking === false)
    return " On your answers, this applies to you but does not block this route.";
  return " Whether this stands in your way is not yet settled either way.";
}

function CheckCard({ check }: { check: CheckItem }) {
  return (
    <li className={CARD}>
      <h3 className={H3}>{check.issue}</h3>
      <p className={`mt-2 ${BODY}`}>{check.whyItMatters}</p>
      {check.affectedRouteLabels.length > 0 ? (
        <p className={`mt-2 ${BODY}`}>
          <span className="font-medium text-foreground">Routes this affects: </span>
          {check.affectedRouteLabels.join(", ")}.
        </p>
      ) : null}
      {check.relatedRequirementLabels.length > 0 ? (
        <p className={`mt-2 ${BODY}`}>
          <span className="font-medium text-foreground">Conditions it relates to: </span>
          {check.relatedRequirementLabels.join(", ")}.
        </p>
      ) : null}
      <p className={`mt-2 ${BODY}`}>
        <span className="font-medium text-foreground">What could settle it: </span>
        {check.whatCouldResolveIt}
      </p>
      {check.relatedActions.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {check.relatedActions.map((action) => (
            <li key={action.actionKey} className="text-[0.95rem] leading-relaxed">
              <span className="font-medium text-foreground">{action.label}</span>{" "}
              <span className="text-muted-foreground">{action.guidance}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function RouteCard({
  route,
  heading,
  showPositions,
}: {
  route: RouteItem;
  heading: string;
  showPositions?: boolean;
}) {
  return (
    <div className={CARD}>
      <p className="text-sm text-muted-foreground">{heading}</p>
      <h3 className={`mt-1 ${H3}`}>{route.label}</h3>

      {route.whyItFits.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
          {route.whyItFits.map((statement) => (
            <li key={statement}>{statement}</li>
          ))}
        </ul>
      ) : null}

      {route.eligibility === null || route.practicalFit === null ? (
        <p className={`mt-3 ${BODY}`}>
          Something about this route is not yet known, so it is neither ruled in nor ruled out.
        </p>
      ) : null}

      {showPositions ? <RoutePositions route={route} /> : null}

      {route.conditions.length > 0 ? (
        <>
          <p className="mt-4 text-sm font-semibold text-foreground">
            What is still outstanding for this route
          </p>
          <RequirementList items={route.conditions} />
        </>
      ) : null}

      {route.met.length > 0 ? (
        <>
          <p className="mt-4 text-sm font-semibold text-foreground">
            What you already have for this route
          </p>
          <RequirementList items={route.met} />
        </>
      ) : null}

      {route.barriers.length > 0 ? (
        <ul className="mt-4 space-y-2 text-[0.95rem] leading-relaxed text-muted-foreground">
          {route.barriers.map((barrier) => (
            <li key={barrier.barrierKey}>
              <span className="font-medium text-foreground">{barrier.label}</span>{" "}
              {barrier.explanation}
              {barrierNote(barrier.blocking)}
            </li>
          ))}
        </ul>
      ) : null}

      {showPositions ? <NextSteps route={route} /> : null}

      <p className="mt-4 border-t border-border pt-4 text-[0.95rem] leading-relaxed text-foreground/90">
        <span className="font-semibold">Before you spend money or time: </span>
        {route.beforeYouSpend}
      </p>
    </div>
  );
}

/** Restrained, honest wording for every non-result outcome. */
function OutcomeUnavailable({
  title,
  body,
  onEditAnswers,
}: {
  title: string;
  body: string;
  onEditAnswers: () => void;
}) {
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border bg-card p-5">
      <h2 className={H3}>{title}</h2>
      <p className={`mt-2 ${BODY}`}>{body}</p>
      <button type="button" className={`mt-5 ${QUIET}`} onClick={onEditAnswers}>
        Back to my answers
      </button>
    </div>
  );
}

export function RealityCheckOutcome({
  occupationKey,
  occupationTitle,
  confirmed,
  reviewItems = [],
  onEditAnswers,
  onStartOver,
}: {
  occupationKey: string;
  occupationTitle: string;
  confirmed: ConfirmedAnswerSet;
  /** The participant's own confirmed answers, from the Increment 15 copy layer. */
  reviewItems?: readonly ReviewItem[];
  onEditAnswers: () => void;
  onStartOver: () => void;
}) {
  const evaluate = useServerFn(evaluateRealityCheckAnswers);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const request = useMemo(
    () => ({
      occupationKey: confirmed.occupationKey,
      pack: {
        careerPackId: confirmed.pack.careerPackId,
        version: confirmed.pack.version,
        contentHash: confirmed.pack.contentHash,
      },
      answers: confirmed.answers.map((entry) => ({
        question: {
          moduleCode: entry.question.moduleCode,
          questionKey: entry.question.questionKey,
        },
        value: Array.isArray(entry.value) ? [...entry.value] : entry.value,
      })),
    }),
    [confirmed],
  );

  const query = useQuery<RealityCheckEvaluationOutcome>({
    queryKey: ["reality-check-evaluation", request],
    queryFn: () => evaluate({ data: request }),
    /* A result is derived, never cached as truth and never retried silently. */
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  const outcome = query.data;
  const model = useMemo(() => {
    if (!outcome || outcome.state !== "evaluated" || !copy) return undefined;
    /*
     * Exact presentation binding. The server has already proven full coverage
     * against the bound pack; identity, version AND the exact canonical content
     * hash must still agree here, so stale copy can never be rendered beside
     * fresh engine truth. The browser compares against the server's pack ref
     * and never re-hashes a pack itself.
     */
    if (!resultCopyMatchesPackRef(copy, outcome.pack)) return undefined;
    return buildResultViewModel({
      evaluation: outcome.evaluation,
      evidence: outcome.evidence,
      copy,
      actionRelations: outcome.actionRelations,
    });
  }, [copy, outcome]);

  /* Focus moves to the result heading once there is something to read. */
  useEffect(() => {
    if (query.isPending) return;
    headingRef.current?.focus();
  }, [query.isPending, model]);

  if (query.isPending) {
    return (
      <section aria-busy="true">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-foreground outline-none"
        >
          Checking your answers against the reviewed conditions
        </h1>
        <p className={`mt-4 max-w-2xl ${BODY}`} role="status" aria-live="polite">
          This takes a moment. No one is being contacted about you.
        </p>
      </section>
    );
  }

  if (!model) {
    const failed = query.isError || outcome === undefined;
    const state = outcome?.state;
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-foreground outline-none"
        >
          We could not give you an answer
        </h1>
        <p className={`mt-4 max-w-2xl ${BODY}`}>
          Your answers are still here, exactly as you gave them.
        </p>
        {state === "answers_incomplete" ? (
          <OutcomeUnavailable
            title="Some answers still need attention"
            body="At least one question that applies to you does not have a usable answer, so nothing can be said about your position yet."
            onEditAnswers={onEditAnswers}
          />
        ) : (
          <OutcomeUnavailable
            title={
              failed ? "Something went wrong on our side" : "We cannot stand behind an answer here"
            }
            body={
              failed
                ? "The check did not complete. Your answers are unchanged, and you can try the same check again."
                : "Rather than show you something we cannot stand behind, we would rather tell you plainly that we cannot answer this right now."
            }
            onEditAnswers={onEditAnswers}
          />
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {/*
           * Retrying only makes sense when the check itself did not complete.
           * A deliberate refusal to answer would refuse identically, so it is
           * never presented as something a participant can retry away.
           */}
          {failed ? (
            <button type="button" className={QUIET} onClick={() => query.refetch()}>
              Try the same check again
            </button>
          ) : null}
          <Link
            to="/careers/$occupationKey"
            params={{ occupationKey }}
            className={`${QUIET} inline-flex justify-center`}
          >
            Back to {occupationTitle}
          </Link>
        </div>
      </section>
    );
  }

  const topRoutes = model.strongestRoute ? [model.strongestRoute] : model.tiedTopRoutes;

  return (
    <section>
      <p className="text-sm text-muted-foreground">Reality Check: {model.careerTitle}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground outline-none sm:text-4xl"
      >
        {model.judgement.label}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/90">
        {model.judgement.meaning}
      </p>
      <div className="mt-5 max-w-2xl rounded-lg border border-border bg-secondary p-5">
        <h2 className="text-sm font-semibold text-foreground">What this does not mean</h2>
        <p className={`mt-2 ${BODY}`}>{model.judgement.whatItIsNot}</p>
        <p className={`mt-2 ${BODY}`}>
          This is based only on what you told us and on the reviewed conditions for this career.
          Where you live, and which employers, providers, courses or vacancies are actually open to
          you near you, has not been looked at.
        </p>
      </div>

      <div className="mt-6 max-w-2xl rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">A quick summary</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
          {model.summaryFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      {topRoutes.length > 0 ? (
        <>
          <h2 className={H2}>
            {model.strongestRoute
              ? model.strongestRouteBasis === "factor_separation"
                ? "The route your answers separate from the others"
                : "The only route still in contention on your answers"
              : "Routes your answers support at the same level"}
          </h2>
          {model.strongestRoute && model.strongestRouteBasis === "sole_viable" ? (
            <p className={`mt-2 max-w-2xl ${BODY}`}>
              Every other route here was ruled out by a blocking issue on your answers. That is not
              a preference between routes, and this route has not been recommended to you.
            </p>
          ) : null}
          {model.strongestRoute ? null : (
            <p className={`mt-2 max-w-2xl ${BODY}`}>
              These routes fit at the same governed level on your answers. The order they appear in
              is not a preference.
            </p>
          )}
          <div className="mt-3 space-y-4">
            {topRoutes.map((route) => (
              <RouteCard
                key={route.routeKey}
                route={route}
                heading={
                  model.strongestRoute
                    ? model.strongestRouteBasis === "factor_separation"
                      ? "Separated by the reviewed factors that matched your answers"
                      : "Not ruled out by a blocking issue on your answers"
                    : "Fits at the same level as the others here"
                }

                showPositions
              />
            ))}
          </div>
        </>
      ) : null}

      {model.otherRoutes.length > 0 ? (
        <>
          <h2 className={H2}>
            {topRoutes.length > 0
              ? "Other routes worth knowing about"
              : "The routes into this work"}
          </h2>
          {model.routePreferenceEstablished ? null : (
            <p className={`mt-2 max-w-2xl ${BODY}`}>
              No route has been preferred over another on your answers, and the order these appear
              in is not a recommendation order.
            </p>
          )}
          <div className="mt-3 space-y-4">
            {model.otherRoutes.map((route) => (
              <RouteCard key={route.routeKey} route={route} heading="A route into this work" />
            ))}
          </div>
        </>
      ) : null}

      {model.unavailableRoutes.length > 0 ? (
        <>
          <h2 className={H2}>Routes unavailable on the answers you gave</h2>
          <ul className="mt-3 max-w-2xl list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
            {model.unavailableRoutes.map((route) => (
              <li key={route.routeKey}>{route.label}</li>
            ))}
          </ul>
        </>
      ) : null}

      {model.overallRequirements.length > 0 ? (
        <>
          <h2 className={H2}>Conditions that apply whichever route you take</h2>
          <div className="mt-3 max-w-2xl">
            <RequirementList items={model.overallRequirements} />
          </div>
        </>
      ) : null}

      {model.unresolved.length > 0 ? (
        <>
          <h2 className={H2}>What is not yet known</h2>
          <p className={`mt-2 max-w-2xl ${BODY}`}>
            Not knowing something is treated as not knowing it. None of these count against you.
          </p>
          <ul className="mt-3 space-y-4">
            {model.unresolved.map((check) => (
              <CheckCard key={check.checkKey} check={check} />
            ))}
          </ul>
        </>
      ) : null}

      {model.barriers.length > 0 ? (
        <>
          <h2 className={H2}>Barriers and practical obstacles</h2>
          <ul className="mt-3 space-y-4">
            {model.barriers.map((barrier) => (
              <li key={barrier.barrierKey} className={CARD}>
                <h3 className={H3}>{barrier.label}</h3>
                <p className={`mt-2 ${BODY}`}>
                  {barrier.explanation}
                  {barrierNote(barrier.blocking)}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {model.actions.length > 0 ? (
        <>
          <h2 className={H2}>What you could do next</h2>
          <p className={`mt-2 max-w-2xl ${BODY}`}>
            These follow from your own answers. None of them is a requirement to use Clear Routes,
            and none of them involves paying us.
          </p>
          <ul className="mt-3 space-y-4">
            {model.actions.map((action) => (
              <li key={action.actionKey} className={CARD}>
                <h3 className={H3}>{action.label}</h3>
                <p className={`mt-2 ${BODY}`}>{action.guidance}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className={H2}>The detail behind this</h2>
      <Accordion type="multiple" className="mt-3 max-w-2xl">
        <AccordionItem value="how">
          <AccordionTrigger>How this was worked out</AccordionTrigger>
          <AccordionContent>
            <p className={BODY}>
              The answers you confirmed were checked against the reviewed conditions recorded for
              this career, and against reviewed sources, by the same rules used for everyone.
              Nothing was interpreted, guessed or generated about you.
            </p>
            <p className={`mt-2 ${BODY}`}>{model.judgement.whatItIsNot}</p>
            <p className={`mt-2 ${BODY}`}>
              Career Pack version {model.provenance.careerPackVersion} · rules version{" "}
              {model.provenance.decisionEngineVersion} · worked out{" "}
              {new Date(model.provenance.evaluatedAt).toUTCString()}.
            </p>
          </AccordionContent>
        </AccordionItem>

        {model.evidence.length > 0 ? (
          <AccordionItem value="sources">
            <AccordionTrigger>Reviewed sources related to what is shown here</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3">
                {model.evidence.map((item) => (
                  <li key={item.evidenceKey} className="text-[0.95rem] leading-relaxed">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {item.label}
                    </a>
                    <span className="text-muted-foreground"> — checked {item.checkedOn}.</span>
                    {item.participantClassification === "confirmed_requirement" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        This states a requirement in the body&rsquo;s own authority.
                      </span>
                    ) : null}
                    {item.participantClassification === "provider_dependent" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        This describes something that varies between employers and providers.
                      </span>
                    ) : null}
                    {item.participantClassification === "general_guidance" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        This is general guidance about typical practice rather than a rule.
                      </span>
                    ) : null}
                    {item.limitation ? (
                      <span className="text-muted-foreground"> {item.limitation}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {reviewItems.length > 0 ? (
          <AccordionItem value="answers">
            <AccordionTrigger>Your answers</AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-3">
                {reviewItems.map((item) => (
                  <div key={`${item.question.moduleCode}:${item.question.questionKey}`}>
                    <dt className="text-[0.95rem] font-medium text-foreground">{item.prompt}</dt>
                    <dd className={BODY}>
                      {item.answerLabel}
                      {item.uncertain ? " (you said you were not sure)" : ""}
                    </dd>
                  </div>
                ))}
              </dl>
              <button type="button" className={`mt-5 ${QUIET}`} onClick={onEditAnswers}>
                Edit answers and recalculate
              </button>
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>

      <div className="mt-10 max-w-2xl rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">How to disagree with this</h2>
        <p className={`mt-2 ${BODY}`}>
          If any of this is wrong about you, your answers are the thing to change — go back and edit
          them, and the answer here is worked out again from scratch. Where a decision belongs to a
          regulator, an employer, a university or an assessment centre, they decide it, not us.
        </p>
        <p className={`mt-2 ${BODY}`}>{SESSION_NOTE}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={QUIET} onClick={onEditAnswers}>
          Edit answers and recalculate
        </button>
        <button type="button" className={QUIET} onClick={onStartOver}>
          Start over
        </button>
        <Link
          to="/careers/$occupationKey"
          params={{ occupationKey }}
          className={`${QUIET} inline-flex justify-center`}
        >
          Back to {occupationTitle}
        </Link>
      </div>
    </section>
  );
}
