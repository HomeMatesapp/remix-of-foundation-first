import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import type { CareerPack } from "../../../domain/career-packs";
import type { QuestionAnswerValue } from "../../../domain/questions";
import type { CoveragePackRef } from "../../../domain/universal-coverage";
import type { CareerQuestionCopy } from "../content-schema";
import type { ConfirmedAnswerSet, ReviewItem } from "../flow";
import { useRealityCheckFlow, type RealityCheckFlow as Flow } from "../controller";

import { QuestionInputControl } from "./question-input";

const PRIMARY =
  "rounded-md bg-primary px-5 py-3 text-base font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const QUIET =
  "rounded-md border border-border px-5 py-3 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const SESSION_NOTE = "Progress is kept in this browser tab while it stays open.";

/**
 * Accessible restart confirmation.
 *
 * Restart is destructive, so it is never immediate. Focus containment, focus
 * return and modal keyboard behaviour (including Escape) come from the
 * repository's established accessible AlertDialog primitive. Cancelling and
 * Escape both route to `cancelRestart`, which changes no flow state at all;
 * confirming is the only destructive path.
 */
function RestartConfirmation({ flow }: { flow: Flow }) {
  return (
    <AlertDialog
      open={flow.restartPending}
      onOpenChange={(open) => {
        if (!open) flow.cancelRestart();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start over and delete your answers?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears every answer you have given for this Reality Check. It cannot be undone, and
            you would begin again at the first question.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={flow.cancelRestart}>
            Cancel and keep my answers
          </AlertDialogCancel>
          <AlertDialogAction onClick={flow.confirmRestart}>
            Yes, delete my answers
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The participant Reality Check question experience.
 *
 * Increment 15 collects and confirms answers only. No result, judgement, route
 * recommendation or evidence explanation is produced or implied here.
 */
export function RealityCheckFlow({
  occupationKey,
  occupationTitle,
  pack,
  packRef,
  copy,
  confirmLabel,
  renderConfirmed,
}: {
  occupationKey: string;
  occupationTitle: string;
  pack: CareerPack;
  packRef: CoveragePackRef;
  copy: CareerQuestionCopy;
  /** Optional caller-supplied label for the confirmation action. */
  confirmLabel?: string;
  /**
   * Optional caller-owned screen for the confirmed stage. This module renders
   * whatever it is given and implements nothing beyond answer collection.
   */
  renderConfirmed?: (state: {
    readonly confirmed: ConfirmedAnswerSet;
    /** The participant's own confirmed answers, in this module's own copy. */
    readonly reviewItems: readonly ReviewItem[];
    readonly backToAnswers: () => void;
    readonly startOver: () => void;
  }) => ReactNode;
}) {
  const flow = useRealityCheckFlow({ occupationKey, pack, packRef, copy });
  const [draft, setDraft] = useState<QuestionAnswerValue | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const currentAddress = flow.current
    ? `${flow.current.ref.moduleCode}:${flow.current.ref.questionKey}`
    : "";
  const currentValue = flow.current?.value;

  /* The pending control value resets to the confirmed answer per question. */
  useEffect(() => {
    setDraft(currentValue);
  }, [currentAddress, currentValue]);

  /*
   * Focus moves to the heading of whatever screen the participant has just been
   * moved to, so a screen-reader or keyboard user is never left behind on the
   * previous question. It never steals focus while a dialog is open.
   */
  useEffect(() => {
    if (flow.restartPending) return;
    headingRef.current?.focus();
  }, [flow.focusNonce, flow.restartPending]);

  const dialog = flow.restartPending ? <RestartConfirmation flow={flow} /> : null;

  if (flow.stage === "start") {
    const { startContent } = flow;
    return (
      <section>
        <Link
          to="/careers/$occupationKey"
          params={{ occupationKey }}
          className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to {occupationTitle}
        </Link>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-3xl font-semibold tracking-tight text-foreground outline-none sm:text-4xl"
        >
          Reality Check: {occupationTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/90">
          {startContent.whatItDoes}
        </p>

        <h2 className="mt-8 text-lg font-semibold tracking-tight text-foreground">
          What you will be asked about
        </h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
          {startContent.informationKinds.map((kind) => (
            <li key={kind}>{kind}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-lg font-semibold tracking-tight text-foreground">
          How long it takes
        </h2>
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          {startContent.effort} One question per screen, and you can go back at any point.
        </p>

        <h2 className="mt-8 text-lg font-semibold tracking-tight text-foreground">
          What it does not do
        </h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
          {startContent.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-lg font-semibold tracking-tight text-foreground">
          How your answers are kept
        </h2>
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          {startContent.saveBehaviour}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {flow.resumable ? (
            <>
              <button type="button" className={PRIMARY} onClick={flow.resume}>
                Continue where you left off
              </button>
              <button type="button" className={QUIET} onClick={flow.requestRestart}>
                Start over
              </button>
            </>
          ) : (
            <button type="button" className={PRIMARY} onClick={flow.start}>
              Start Reality Check
            </button>
          )}
        </div>
        {dialog}
      </section>
    );
  }

  if (flow.stage === "questions" && flow.current) {
    const { current } = flow;
    const valid = draft !== undefined;
    const progressLabel = `Question ${current.position} of ${current.askedCount} so far`;

    return (
      <section>
        <p className="text-sm text-muted-foreground">Reality Check: {occupationTitle}</p>
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={current.position}
            aria-valuemin={1}
            aria-valuemax={current.askedCount}
            aria-label="Reality Check progress"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(current.position / current.askedCount) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">
            {progressLabel}
          </span>
        </div>
        {/*
         * Explicit assistive-technology announcement of the progress change when
         * the visible question changes. It carries only the currently visible
         * asked-question progress, and is polite so it never interrupts the
         * heading focus move.
         */}
        <p className="sr-only" role="status" aria-live="polite">
          {progressLabel}
        </p>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 text-2xl font-semibold leading-snug tracking-tight text-foreground outline-none sm:text-3xl"
        >
          {current.copy?.prompt}
        </h1>
        {current.copy?.helpText ? (
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
            {current.copy.helpText}
          </p>
        ) : null}

        <div className="mt-7">
          <QuestionInputControl
            definition={current.definition}
            copy={current.copy}
            draft={draft}
            onDraftChange={setDraft}
          />
        </div>
        {current.copy?.evidenceLater ? (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Evidence later: </span>
            {current.copy.evidenceLater}
          </p>
        ) : null}

        {current.copy?.whyWeAsk ? (
          <details className="mt-6 rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Why we ask
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {current.copy.whyWeAsk}
            </p>
          </details>
        ) : null}

        {flow.rejection ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            That answer cannot be accepted as it stands. Please check it and try again.
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            className={PRIMARY}
            disabled={!valid}
            onClick={() => {
              if (draft !== undefined) flow.submit(draft);
            }}
          >
            Continue
          </button>
          <button type="button" className={QUIET} onClick={flow.back}>
            Back
          </button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{SESSION_NOTE}</p>
        {dialog}
      </section>
    );
  }

  if (flow.stage === "review") {
    const unsureCount = flow.reviewItems.filter((item) => item.uncertain).length;
    const { jurisdictionLabel } = flow.assessmentContext;
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-foreground outline-none"
        >
          Check your answers
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          Nothing is confirmed until you choose to confirm. Change anything that is not right; later
          questions will adjust to your change.
        </p>

        <div className="mt-6 max-w-2xl rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">What these answers describe</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {flow.assessmentContext.careerTitle}
            {jurisdictionLabel ? ` — as you have described it for ${jurisdictionLabel}.` : "."}
          </p>
          {jurisdictionLabel ? null : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              These answers describe your own circumstances only. No location or local opportunity
              data is used at this stage.
            </p>
          )}
        </div>

        {unsureCount > 0 ? (
          <div className="mt-4 max-w-2xl rounded-lg border border-border bg-secondary p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {unsureCount === 1
                ? "You were unsure about 1 answer"
                : `You were unsure about ${unsureCount} answers`}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              That is a perfectly acceptable answer, and it is kept exactly as you gave it. Where
              you are unsure, or where something you have said still needs to be checked or
              verified, how much can later be said about your position is limited accordingly. The
              answers marked below are the ones concerned.
            </p>
          </div>
        ) : null}

        <ul className="mt-8 space-y-4">
          {flow.reviewItems.map((item) => (
            <li
              key={`${item.question.moduleCode}:${item.question.questionKey}`}
              className="rounded-lg border border-border bg-card p-5"
            >
              <p className="text-sm text-muted-foreground">{item.prompt}</p>
              <p className="mt-1 text-base text-foreground">{item.answerLabel}</p>
              {item.uncertain ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recorded as unsure. This limits what can later be said about this point.
                </p>
              ) : null}
              <button
                type="button"
                className="mt-3 rounded-sm text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => flow.editQuestion(item.question)}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
        {flow.missing.length > 0 ? (
          <p className="mt-6 text-sm text-destructive" role="alert">
            Some questions still need an answer before you can confirm.
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button type="button" className={PRIMARY} onClick={flow.confirm}>
            {confirmLabel ?? "Confirm my answers"}
          </button>
          <button type="button" className={QUIET} onClick={flow.requestRestart}>
            Start over
          </button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{SESSION_NOTE}</p>
        {dialog}
      </section>
    );
  }

  if (renderConfirmed && flow.confirmed) {
    return (
      <>
        {renderConfirmed({
          confirmed: flow.confirmed,
          reviewItems: flow.reviewItems,
          backToAnswers: flow.backToReview,
          startOver: flow.requestRestart,
        })}
        {dialog}
      </>
    );
  }

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-semibold tracking-tight text-foreground outline-none"
      >
        Your answers are confirmed
      </h1>
      <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
        You have confirmed {flow.confirmed?.answers.length ?? 0} answers for {occupationTitle}. The
        Reality Check result view is not part of this build stage yet, so nothing here tells you
        whether this career is realistic for you.
      </p>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
        {SESSION_NOTE}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/careers/$occupationKey"
          params={{ occupationKey }}
          className={QUIET + " inline-flex justify-center"}
        >
          Back to {occupationTitle}
        </Link>
        <button type="button" className={QUIET} onClick={flow.requestRestart}>
          Start over
        </button>
      </div>
      {dialog}
    </section>
  );
}
