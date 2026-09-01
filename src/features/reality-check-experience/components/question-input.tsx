import { useEffect, useRef, useState } from "react";

import type { QuestionAnswerValue, QuestionDefinition } from "../../../domain/questions";
import type { QuestionCopy } from "../content-schema";
import {
  describeAnswerRejection,
  describeInputConstraint,
  validateAnswerValue,
} from "../validation";

/**
 * Generic renderer for the seven structural input kinds.
 *
 * Every constraint comes from the Career Pack's own declared input. Option
 * values are always the exact declared option keys; typed text is never
 * reinterpreted as anything other than text.
 *
 * Typed fields keep exactly what the participant entered while it is invalid and
 * explain, field-adjacent, how to correct it. The validator is the SAME
 * Increment 15 input-boundary validator used by the flow; nothing is duplicated
 * or weakened here.
 */

const FIELD =
  "w-full rounded-md border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const FIELD_INVALID = "border-destructive";

function ChoiceButton({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-3.5 text-left text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        selected
          ? "border-primary bg-secondary font-medium text-foreground"
          : "border-border bg-card text-foreground hover:border-primary/60"
      }`}
    >
      {label}
    </button>
  );
}

export function QuestionInputControl({
  definition,
  copy,
  draft,
  onDraftChange,
}: {
  definition: QuestionDefinition;
  copy: QuestionCopy | undefined;
  draft: QuestionAnswerValue | undefined;
  onDraftChange: (value: QuestionAnswerValue | undefined) => void;
}) {
  const input = definition.input;
  const address = `${definition.moduleCode}:${definition.questionKey}`;
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /*
   * Raw typed text is reset only when the QUESTION changes. It is deliberately
   * NOT cleared when validation rejects the current text, so the participant can
   * see and correct exactly what they entered.
   */
  useEffect(() => {
    const value = draftRef.current;
    setRaw(
      value === undefined || typeof value === "boolean" || Array.isArray(value)
        ? ""
        : String(value),
    );
    setMessage(undefined);
  }, [address]);

  const labelFor = (optionKey: string): string =>
    copy?.options?.find((option) => option.optionKey === optionKey)?.label ?? optionKey;

  if (input.kind === "boolean") {
    return (
      <div className="grid gap-3">
        {[true, false].map((option) => (
          <ChoiceButton
            key={String(option)}
            selected={draft === option}
            label={option ? "Yes" : "No"}
            onSelect={() => onDraftChange(option)}
          />
        ))}
      </div>
    );
  }

  if (input.kind === "single_select") {
    return (
      <div className="grid gap-3">
        {input.optionKeys.map((optionKey) => (
          <ChoiceButton
            key={optionKey}
            selected={draft === optionKey}
            label={labelFor(optionKey)}
            onSelect={() => onDraftChange(optionKey)}
          />
        ))}
      </div>
    );
  }

  if (input.kind === "multi_select") {
    const selected = Array.isArray(draft) ? draft : [];
    return (
      <div className="grid gap-3">
        {input.optionKeys.map((optionKey) => {
          const isSelected = selected.includes(optionKey);
          return (
            <ChoiceButton
              key={optionKey}
              selected={isSelected}
              label={labelFor(optionKey)}
              onSelect={() => {
                const next = isSelected
                  ? selected.filter((entry) => entry !== optionKey)
                  : [...selected, optionKey];
                onDraftChange(next.length === 0 ? undefined : next);
              }}
            />
          );
        })}
        <p className="text-sm text-muted-foreground">Choose all that apply.</p>
      </div>
    );
  }

  const errorId = "answer-error";
  const hintId = "answer-hint";
  const hint = describeInputConstraint(input);
  const invalid = message !== undefined;

  /** Applies typed text: raw is always preserved, validity decides the draft. */
  const apply = (text: string): void => {
    setRaw(text);
    if (text.trim() === "") {
      setMessage(undefined);
      onDraftChange(undefined);
      return;
    }
    const candidate: QuestionAnswerValue =
      input.kind === "integer" || input.kind === "decimal" ? Number(text) : text;
    if (typeof candidate === "number" && Number.isNaN(candidate)) {
      setMessage(describeAnswerRejection(input, "non_finite"));
      onDraftChange(undefined);
      return;
    }
    const validation = validateAnswerValue(input, candidate);
    if (!validation.ok) {
      setMessage(describeAnswerRejection(input, validation.code));
      onDraftChange(undefined);
      return;
    }
    setMessage(undefined);
    onDraftChange(candidate);
  };

  const described = [hint ? hintId : undefined, invalid ? errorId : undefined]
    .filter((entry) => entry !== undefined)
    .join(" ");

  const shared = {
    className: `mt-2 ${FIELD} ${invalid ? FIELD_INVALID : ""}`,
    value: raw,
    "aria-invalid": invalid,
    ...(described === "" ? {} : { "aria-describedby": described }),
    onChange: (event: { target: { value: string } }) => apply(event.target.value),
  } as const;

  const messages = (
    <>
      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {invalid ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-destructive">
          {message}
        </p>
      ) : null}
    </>
  );

  if (input.kind === "integer" || input.kind === "decimal") {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-foreground" htmlFor="answer-number">
          {copy?.valueHint ?? "Amount"}
        </label>
        <input
          id="answer-number"
          type="number"
          inputMode={input.kind === "integer" ? "numeric" : "decimal"}
          step={input.kind === "integer" ? 1 : "any"}
          {...shared}
        />
        {messages}
      </div>
    );
  }

  if (input.kind === "date") {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-foreground" htmlFor="answer-date">
          {copy?.valueHint ?? "Date"}
        </label>
        <input id="answer-date" type="date" {...shared} />
        {messages}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground" htmlFor="answer-text">
        {copy?.valueHint ?? "Your answer"}
      </label>
      {/*
       * Participant text is preserved verbatim. It is never interpreted into a
       * boolean, option key, number or date.
       */}
      <textarea id="answer-text" rows={4} {...shared} />
      {messages}
    </div>
  );
}
