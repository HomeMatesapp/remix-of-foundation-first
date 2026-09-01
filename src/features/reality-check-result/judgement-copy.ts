import type { RealityCheckJudgement } from "../../domain/contracts";

/**
 * Participant wording for the four PROTECTED judgement values.
 *
 * The vocabulary itself is frozen: exactly four values, no fifth state, no
 * alias and no softened variant. This module only supplies wording for the
 * value the Decision Engine already produced, and can never change it.
 *
 * `whatItIsNot` is mandatory for every judgement: no judgement is ever
 * presented without its own honest limit.
 */
export interface JudgementCopy {
  readonly label: string;
  readonly meaning: string;
  readonly whatItIsNot: string;
}

export const JUDGEMENT_COPY: Readonly<Record<RealityCheckJudgement, JudgementCopy>> = Object.freeze(
  {
    realistic_now: {
      label: "Realistic now",
      meaning:
        "Based on what you have told us, nothing in the reviewed conditions for this career currently stands in your way.",
      whatItIsNot:
        "This is not an offer, a place, a job or a promise. It says the conditions look satisfied on your own account of your position, and anything you have not checked yet can still change that.",
    },
    realistic_with_conditions: {
      label: "Realistic, with conditions",
      meaning:
        "This career looks open to you, but specific conditions are still outstanding and they are set out below.",
      whatItIsNot:
        "It is not a refusal, and it is not a ranking of you. Conditions are things that can be met, checked or worked towards, not verdicts on your ability.",
    },
    not_realistic_yet: {
      label: "Not realistic yet",
      meaning:
        "On what you have described, at least one reviewed condition is not met at the moment, so this is about where you are today rather than where you could be.",
      whatItIsNot:
        "It is not a statement that you cannot do this work, and it is not permanent. It never means the career is closed to you — only that something specific stands between you and it right now.",
    },
    more_information_needed: {
      label: "More information needed",
      meaning:
        "Something that matters is genuinely not known yet, so saying anything stronger would be guessing.",
      whatItIsNot:
        "This is not a negative answer. Not knowing is treated as not knowing, and the specific unknowns are listed below so you can find out.",
    },
  },
);
