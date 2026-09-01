import { z } from "zod";

/**
 * Protected Reality Check judgement vocabulary.
 *
 * These four machine values are exact and frozen. No aliases, no legacy values,
 * no UI labels, no fifth state. Expanding this vocabulary is a breaking
 * architecture change requiring explicit owner approval.
 *
 * Decision state (what the participant commits to) is a SEPARATE concept and is
 * intentionally NOT defined in Increment 2.
 */
export const REALITY_CHECK_JUDGEMENTS = [
  "realistic_now",
  "realistic_with_conditions",
  "not_realistic_yet",
  "more_information_needed",
] as const;

export const realityCheckJudgementSchema = z.enum(REALITY_CHECK_JUDGEMENTS);
export type RealityCheckJudgement = z.infer<typeof realityCheckJudgementSchema>;
