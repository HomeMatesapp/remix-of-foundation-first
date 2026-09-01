import { Link } from "@tanstack/react-router";

import type { OverviewSource } from "../content-schema";
import { formatGbpAnnual, type RoleOverviewViewModel } from "../view-model";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-foreground">
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-foreground/60"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Sources({ sources }: { sources: readonly OverviewSource[] }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        These sources support the descriptive context on this page. They are not the Reality Check's
        evidence-strength authority.
      </p>
      <ul className="mt-4 space-y-3">
        {sources.map((source) => (
          <li key={source.sourceKey} className="text-sm">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {source.label}
            </a>
            <span className="text-muted-foreground"> — checked {source.checkedAt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact per-route citation. Descriptive source links only, never a grade. */
function RouteCitations({
  sources,
  verificationNote,
}: {
  sources: readonly OverviewSource[];
  verificationNote?: string | undefined;
}) {
  if (verificationNote) {
    return <p className="mt-3 text-sm text-muted-foreground">{verificationNote}</p>;
  }
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      <span className="font-medium text-foreground/80">Sources: </span>
      {sources.map((source, index) => (
        <span key={source.sourceKey}>
          {index > 0 ? ", " : ""}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {source.label}
          </a>
        </span>
      ))}
      {sources[0] ? <span> — checked {sources[0].checkedAt}</span> : null}
    </p>
  );
}

/** Participant role overview. Renders descriptive context only. */
export function RoleOverview({ model }: { model: RoleOverviewViewModel }) {
  const assessmentSupported = model.assessment.state === "assessment_available";
  const sourceByKey: Record<string, OverviewSource | undefined> = Object.fromEntries(
    model.sources.map((source) => [source.sourceKey, source]),
  );

  return (
    <article className="pb-4">
      <Link
        to="/"
        className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to career search
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {model.occupation.canonicalTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/90">{model.summary}</p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <dt className="text-sm font-medium text-muted-foreground">Typical pay</dt>
          <dd className="mt-1 text-base text-foreground">
            {formatGbpAnnual(model.salary.starterGbp)} starting to{" "}
            {formatGbpAnnual(model.salary.experiencedGbp)} when experienced, a year.
            <span className="mt-1 block text-sm text-muted-foreground">
              {model.salary.source.label}, checked {model.salary.source.checkedAt}.
            </span>
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <dt className="text-sm font-medium text-muted-foreground">Typical hours</dt>
          <dd className="mt-1 text-base text-foreground">
            {model.workPattern.typicalHours}.
            <span className="mt-1 block text-sm text-muted-foreground">
              {model.workPattern.patternSummary}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground">Demand and market context</h2>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground">
          {model.marketContextSummary}
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-secondary p-6">
        {/*
         * The call to action is navigable ONLY when the injected Increment 13
         * coverage outcome says a full assessment is available. This component
         * never infers availability itself; unsupported careers keep a real
         * disabled control with no handler.
         */}
        {assessmentSupported ? (
          <Link
            to="/careers/$occupationKey/reality-check"
            params={{ occupationKey: model.occupation.occupationKey }}
            className="inline-flex w-full justify-center rounded-md bg-primary px-5 py-3 text-base font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            Start Reality Check
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full cursor-not-allowed rounded-md bg-primary px-5 py-3 text-base font-medium text-primary-foreground opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            Start Reality Check
          </button>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {assessmentSupported
            ? "The Reality Check asks about your starting point. It does not guarantee admission, employment, registration or acceptance by any provider."
            : "A full Reality Check is not available for this career yet."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Availability where you live is not part of this overview yet.
        </p>
      </div>

      <Section title="What the work is actually like">
        <Bullets items={model.dayToDay} />
      </Section>

      <Section title="Ways into this career">
        <ul className="space-y-3">
          {model.routeDisplays.map((route) => (
            <li key={route.routeKey} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-base font-medium text-foreground">{route.label}</h3>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">
                {route.summary}
              </p>
              <RouteCitations
                sources={(route.sourceKeys ?? []).flatMap((key) => {
                  const source = sourceByKey[key];
                  return source ? [source] : [];
                })}
                verificationNote={route.verificationNote}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          These are the recognised ways into this career. This page does not say which of them is
          open to you.
        </p>
      </Section>

      <Section title="What may appeal">
        <Bullets items={model.appeal} />
      </Section>

      <Section title="What can be hard">
        <Bullets items={model.challenges} />
      </Section>

      <Section title="Sources">
        <Sources sources={model.sources} />
      </Section>
    </article>
  );
}
