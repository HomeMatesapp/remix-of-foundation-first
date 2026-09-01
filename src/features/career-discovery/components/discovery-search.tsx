import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { OccupationRef, OccupationUniverse } from "../../../domain/occupation-universe";
import {
  listCanonicalExamples,
  resolveDiscoverySubmission,
  type DiscoverySubmission,
} from "../view-model";

function RoleLink({ occupation, className }: { occupation: OccupationRef; className?: string }) {
  return (
    <Link
      to="/careers/$occupationKey"
      params={{ occupationKey: occupation.occupationKey }}
      className={
        className ??
        "rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-accent-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      }
    >
      {occupation.canonicalTitle}
    </Link>
  );
}

/**
 * Career search. Submission is resolved by the closed Increment 12 resolver; this
 * component adds no matching, ranking, suggestion or scoring behaviour, and shows
 * no score, confidence or distance.
 */
export function DiscoverySearch({ universe }: { universe: OccupationUniverse }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<DiscoverySubmission | null>(null);
  const examples = listCanonicalExamples(universe);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submission = resolveDiscoverySubmission(universe, query);
    if (submission.kind === "navigate") {
      setOutcome(null);
      void navigate({
        to: "/careers/$occupationKey",
        params: { occupationKey: submission.occupation.occupationKey },
      });
      return;
    }
    setOutcome(submission);
  }

  return (
    <section className="mt-10">
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="career-search" className="block text-sm font-medium text-foreground">
          Which career do you want to understand?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="career-search"
            name="career-search"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-md border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            placeholder={
              examples[0] ? `For example, ${examples[0].canonicalTitle}` : "Enter a job title"
            }
          />
          <button
            type="submit"
            className="shrink-0 whitespace-nowrap rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Find this career
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          This preview currently includes four careers. Clear Routes will not guess when a title is
          ambiguous or not yet available.
        </p>
      </form>

      {outcome?.kind === "choice_required" ? (
        <div
          className="mt-6 rounded-lg border border-border bg-card p-5"
          role="group"
          aria-label="Choose which career you mean"
        >
          <h2 className="text-sm font-semibold text-foreground">
            That could mean more than one career
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the one you mean, so nothing is assumed for you.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {outcome.candidates.map((candidate) => (
              <li key={candidate.occupationKey}>
                <RoleLink occupation={candidate} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome?.kind === "no_confident_match" ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            We could not confidently match that
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            That title may not be in this preview's four careers yet, or Clear Routes could not
            confidently match your words to one specific role. Either way, nothing has been assumed
            or recorded. Try a more specific job title, or pick one of the careers below.
          </p>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          The four careers you can explore today
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {examples.map((occupation) => (
            <li key={occupation.occupationKey}>
              <RoleLink occupation={occupation} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
