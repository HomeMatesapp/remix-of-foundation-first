import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CareerPack } from "../../domain/career-packs";
import {
  formatQuestionAddress,
  type QuestionAnswerValue,
  type QuestionDefinition,
  type QuestionRef,
} from "../../domain/questions";
import type { CoveragePackRef } from "../../domain/universal-coverage";

import { questionCopyFor, type CareerQuestionCopy, type QuestionCopy } from "./content-schema";
import { discardDraft, loadDraft, saveDraft } from "./draft";
import { buildStartScreenContent, type StartScreenContent } from "./start-screen";
import {
  answerFor,
  applyAnswer,
  askedQuestions,
  buildReviewItems,
  confirmAnswers,
  deriveAssessmentContext,
  resolveNextTarget,
  resolveResumeTarget,
  type AnswerEntry,
  type ConfirmedAnswerSet,
  type ReviewItem,
} from "./flow";
import type { AnswerRejectionCode } from "./validation";

/**
 * Increment 15 — the single Reality Check flow controller.
 *
 * One coherent state machine owns stage, cursor, draft answers and the
 * browser-session draft. Components render it and hold no independent flow
 * state. It collects and confirms answers; it never evaluates them.
 */

export type RealityCheckStage = "start" | "questions" | "review" | "confirmed";

export interface CurrentQuestion {
  readonly definition: QuestionDefinition;
  readonly ref: QuestionRef;
  readonly copy: QuestionCopy | undefined;
  readonly value: QuestionAnswerValue | undefined;
  /** 1-based position within the CURRENTLY asked set. Never a fixed total. */
  readonly position: number;
  readonly askedCount: number;
}

export interface RealityCheckFlow {
  readonly stage: RealityCheckStage;
  readonly careerTitle: string;
  readonly resumable: boolean;
  readonly current: CurrentQuestion | undefined;
  readonly reviewItems: readonly ReviewItem[];
  readonly rejection: AnswerRejectionCode | undefined;
  readonly missing: readonly QuestionRef[];
  readonly confirmed: ConfirmedAnswerSet | undefined;
  /** Derived start-screen content for this exact pack. */
  readonly startContent: StartScreenContent;
  /** Truthful context: canonical career plus any answered nation question. */
  readonly assessmentContext: {
    readonly careerTitle: string;
    readonly jurisdictionLabel: string | undefined;
  };
  /** True while a restart that WOULD discard answers awaits confirmation. */
  readonly restartPending: boolean;
  /** Increments whenever the focus target changes, for predictable focus moves. */
  readonly focusNonce: number;
  readonly start: () => void;
  readonly resume: () => void;
  /** Asks for confirmation when a draft exists; otherwise restarts directly. */
  readonly requestRestart: () => void;
  readonly cancelRestart: () => void;
  readonly confirmRestart: () => void;
  readonly submit: (value: QuestionAnswerValue) => void;
  readonly back: () => void;
  readonly editQuestion: (ref: QuestionRef) => void;
  readonly confirm: () => void;
  /** Returns to review from a later screen, keeping every confirmed answer. */
  readonly backToReview: () => void;
}

function indexOfRef(questions: readonly QuestionDefinition[], ref: QuestionRef): number {
  return questions.findIndex(
    (question) => formatQuestionAddress(question) === formatQuestionAddress(ref),
  );
}

export function useRealityCheckFlow(input: {
  readonly occupationKey: string;
  readonly pack: CareerPack;
  readonly packRef: CoveragePackRef;
  readonly copy: CareerQuestionCopy;
}): RealityCheckFlow {
  const { occupationKey, pack, packRef, copy } = input;

  const [stage, setStage] = useState<RealityCheckStage>("start");
  const [entries, setEntries] = useState<readonly AnswerEntry[]>([]);
  const [cursor, setCursor] = useState(0);
  const [resumable, setResumable] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [rejection, setRejection] = useState<AnswerRejectionCode | undefined>(undefined);
  const [missing, setMissing] = useState<readonly QuestionRef[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedAnswerSet | undefined>(undefined);
  const [savedStage, setSavedStage] = useState<"questions" | "review" | undefined>(undefined);
  const [savedCurrent, setSavedCurrent] = useState<QuestionRef | undefined>(undefined);
  const [restartPending, setRestartPending] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const hydrated = useRef(false);

  /* Browser-session draft is read after hydration only. */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const draft = loadDraft({ occupationKey, packRef, pack });
    if (draft && draft.answers.length > 0) {
      setEntries(draft.answers);
      setSavedStage(draft.stage);
      setSavedCurrent(draft.currentQuestion);
      setResumable(true);
    }
  }, [occupationKey, pack, packRef]);

  const asked = useMemo(() => askedQuestions(pack, entries), [pack, entries]);

  const persist = useCallback(
    (
      next: readonly AnswerEntry[],
      nextStage: "questions" | "review",
      currentQuestion?: QuestionRef | undefined,
    ) => {
      saveDraft({
        occupationKey,
        packRef,
        answers: next,
        stage: nextStage,
        ...(currentQuestion ? { currentQuestion } : {}),
      });
    },
    [occupationKey, packRef],
  );

  const start = useCallback(() => {
    setEntries([]);
    setCursor(0);
    setResumable(false);
    setReturnToReview(false);
    setMissing([]);
    setRejection(undefined);
    setSavedStage(undefined);
    setSavedCurrent(undefined);
    setRestartPending(false);
    discardDraft(occupationKey, packRef);
    setStage("questions");
    setFocusNonce((value) => value + 1);
  }, [occupationKey, packRef]);

  /*
   * A saved review stage is honoured only when the restored draft is still
   * complete for the CURRENTLY asked set; otherwise the participant resumes at
   * the first missing visible question.
   */
  const resume = useCallback(() => {
    const target = resolveResumeTarget({ pack, entries, savedStage, savedCurrent });
    setReturnToReview(false);
    setRejection(undefined);
    setFocusNonce((value) => value + 1);
    if (target.stage === "review") {
      setStage("review");
      return;
    }
    setCursor(target.index);
    setStage("questions");
  }, [pack, entries, savedStage, savedCurrent]);

  /**
   * Restart paths that WOULD discard existing answers must be confirmed first.
   * Nothing is cleared here.
   */
  const requestRestart = useCallback(() => {
    if (entries.length === 0) {
      setStage("start");
      setResumable(false);
      setConfirmed(undefined);
      setFocusNonce((value) => value + 1);
      return;
    }
    setRestartPending(true);
  }, [entries.length]);

  /** Cancel preserves the exact draft and the exact current flow state. */
  const cancelRestart = useCallback(() => {
    setRestartPending(false);
  }, []);

  const startOver = useCallback(() => {
    setRestartPending(false);
    discardDraft(occupationKey, packRef);
    setEntries([]);
    setCursor(0);
    setResumable(false);
    setReturnToReview(false);
    setMissing([]);
    setRejection(undefined);
    setConfirmed(undefined);
    setSavedStage(undefined);
    setSavedCurrent(undefined);
    setStage("start");
    setFocusNonce((value) => value + 1);
  }, [occupationKey, packRef]);

  const submit = useCallback(
    (value: QuestionAnswerValue) => {
      const question = asked[cursor];
      if (!question) return;
      const ref = { moduleCode: question.moduleCode, questionKey: question.questionKey };
      const result = applyAnswer(pack, entries, ref, value);
      if (!result.ok) {
        setRejection(result.validation.ok ? undefined : result.validation.code);
        return;
      }
      setRejection(undefined);
      setEntries(result.entries);

      /*
       * An edit made from review may reveal newly asked questions. Those are
       * traversed in canonical currently-asked order BEFORE returning to review.
       */
      const target = resolveNextTarget({ pack, entries: result.entries, answered: ref });
      setFocusNonce((value) => value + 1);
      if (target.stage === "review") {
        setReturnToReview(false);
        setStage("review");
        setSavedStage("review");
        setSavedCurrent(undefined);
        persist(result.entries, "review");
        return;
      }
      setCursor(target.index);
      setSavedStage("questions");
      const next = askedQuestions(pack, result.entries)[target.index];
      const nextRef = next
        ? { moduleCode: next.moduleCode, questionKey: next.questionKey }
        : undefined;
      setSavedCurrent(nextRef);
      persist(result.entries, "questions", nextRef);
    },
    [asked, cursor, entries, pack, persist],
  );

  const back = useCallback(() => {
    setRejection(undefined);
    setFocusNonce((value) => value + 1);
    if (returnToReview) {
      setReturnToReview(false);
      setStage("review");
      setSavedStage("review");
      setSavedCurrent(undefined);
      persist(entries, "review");
      return;
    }
    if (cursor === 0) {
      setStage("start");
      setResumable(entries.length > 0);
      return;
    }
    const target = cursor - 1;
    setCursor(target);
    const question = asked[target];
    const ref = question
      ? { moduleCode: question.moduleCode, questionKey: question.questionKey }
      : undefined;
    setSavedCurrent(ref);
    /* A refresh after Back must return to the same question. */
    persist(entries, "questions", ref);
  }, [asked, cursor, entries, persist, returnToReview]);

  const editQuestion = useCallback(
    (ref: QuestionRef) => {
      const index = indexOfRef(asked, ref);
      if (index === -1) return;
      setRejection(undefined);
      setMissing([]);
      setReturnToReview(true);
      setCursor(index);
      setStage("questions");
      setFocusNonce((value) => value + 1);
      setSavedStage("questions");
      setSavedCurrent(ref);
      persist(entries, "questions", ref);
    },
    [asked, entries, persist],
  );

  const confirm = useCallback(() => {
    const result = confirmAnswers({ pack, packRef, occupationKey, entries });
    if (!result.ok) {
      setMissing(result.missing);
      const first = result.missing[0];
      if (first) {
        const index = indexOfRef(asked, first);
        if (index !== -1) {
          setReturnToReview(true);
          setCursor(index);
          setStage("questions");
        }
      }
      return;
    }
    setMissing([]);
    setConfirmed(result.confirmed);
    setStage("confirmed");
    setFocusNonce((value) => value + 1);
  }, [asked, entries, occupationKey, pack, packRef]);

  /*
   * A participant may step back from a later screen to their own answers. The
   * confirmed set is dropped so nothing downstream can keep using a set the
   * participant has reopened; the answers themselves are untouched.
   */
  const backToReview = useCallback(() => {
    setConfirmed(undefined);
    setMissing([]);
    setRejection(undefined);
    setReturnToReview(false);
    setStage("review");
    setFocusNonce((value) => value + 1);
  }, []);

  const current = useMemo<CurrentQuestion | undefined>(() => {
    if (stage !== "questions") return undefined;
    const definition = asked[cursor];
    if (!definition) return undefined;
    const ref = { moduleCode: definition.moduleCode, questionKey: definition.questionKey };
    return {
      definition,
      ref,
      copy: questionCopyFor(copy, ref),
      value: answerFor(entries, ref),
      position: cursor + 1,
      askedCount: asked.length,
    };
  }, [asked, copy, cursor, entries, stage]);

  /*
   * Also built at the confirmed stage so a caller-owned confirmed screen can
   * show the participant's own answers from THIS single source of question
   * presentation truth rather than a second one.
   */
  const reviewItems = useMemo(
    () =>
      stage === "review" || stage === "confirmed" ? buildReviewItems(pack, copy, entries) : [],
    [copy, entries, pack, stage],
  );

  const startContent = useMemo(
    () => buildStartScreenContent({ careerTitle: copy.careerTitle, pack }),
    [copy.careerTitle, pack],
  );

  const assessmentContext = useMemo(
    () => deriveAssessmentContext(pack, copy, entries),
    [copy, entries, pack],
  );

  return {
    stage,
    careerTitle: copy.careerTitle,
    resumable,
    current,
    reviewItems,
    rejection,
    missing,
    confirmed,
    startContent,
    assessmentContext,
    restartPending,
    focusNonce,
    start,
    resume,
    requestRestart,
    cancelRestart,
    confirmRestart: startOver,
    submit,
    back,
    editQuestion,
    confirm,
    backToReview,
  };
}
