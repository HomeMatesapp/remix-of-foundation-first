import type { CareerPack } from "../../domain/career-packs";
import type { QuestionModuleCode } from "../../domain/questions";

import { askedQuestions, orderedPackQuestions } from "./flow";

/**
 * Increment 15 — pure derivation of the participant START-SCREEN content.
 *
 * Every statement here is either fixed, honest product wording or derived from
 * the exact Career Pack in front of the participant. Nothing is hardcoded per
 * career, nothing claims a category the pack does not ask about, and nothing
 * implies a result, judgement or guarantee.
 */

export interface StartScreenContent {
  readonly careerTitle: string;
  /** What the Reality Check does, in plain English. */
  readonly whatItDoes: string;
  /** Kinds of information this exact pack asks about, derived from its modules. */
  readonly informationKinds: readonly string[];
  /** Honest effort estimate, cautious when the pack can adapt. */
  readonly effort: string;
  readonly limitations: readonly string[];
  readonly saveBehaviour: string;
}

/**
 * Plain-English information kinds, mapped one-to-one from the canonical question
 * module catalogue.
 *
 * The type is exhaustive over `QuestionModuleCode` on purpose: a governed
 * addition, removal or rename of a module fails compilation here rather than
 * silently leaving participant copy wrong or incomplete. A module is only ever
 * described when the pack in front of the participant actually declares it.
 */
export const MODULE_INFORMATION_KINDS: Readonly<Record<QuestionModuleCode, string>> = Object.freeze(
  {
    qualifications: "qualifications you already hold or are working towards",
    experience: "paid or practical experience",
    employment_income: "your current work and income circumstances",
    study_availability: "how much study or training time you can commit",
    finance: "money and funding circumstances",
    postcode_geography: "where in the UK you are based",
    travel_relocation: "where in the UK you would train or work, and how far you could travel",
    caring_practical: "caring responsibilities and other practical commitments",
    driving: "driving and transport",
    portfolio: "a portfolio of your own work, and the equipment you can use",
    registration: "registration or licensing you already hold",
    background_checks: "health, character and background declarations",
    physical_work_pattern: "physical demands and working patterns you can manage",
  },
);

export function buildStartScreenContent(input: {
  readonly careerTitle: string;
  readonly pack: CareerPack;
}): StartScreenContent {
  const { careerTitle, pack } = input;

  const kinds: string[] = [];
  for (const module of pack.questionModules) {
    const described = MODULE_INFORMATION_KINDS[module.moduleCode];
    if (described !== undefined && !kinds.includes(described)) kinds.push(described);
  }
  if (kinds.length === 0) kinds.push("your qualifications, experience and practical circumstances");

  /*
   * The count is the questions this pack asks RIGHT NOW, with nothing answered.
   * Where any question is conditional, the total can legitimately change, so the
   * wording stays cautious rather than promising a fixed number.
   */
  const initial = askedQuestions(pack, []).length;
  const adaptive = orderedPackQuestions(pack).some((question) => question.dependency !== undefined);
  const effort = adaptive
    ? `Around ${initial} questions to begin with. Some later questions depend on your earlier answers, so the exact number can change.`
    : `A short set of ${initial} questions.`;

  return {
    careerTitle,
    whatItDoes: `This checks the starting point you describe against the conditions attached to the recognised ways into ${careerTitle}. It asks only questions whose answers can change what applies to you.`,
    informationKinds: kinds,
    effort,
    limitations: [
      "It does not guarantee admission, employment, registration or acceptance by any provider.",
      "It does not use where you live, or any local opportunity data, at this stage. It may still ask which UK nation you are in, because entry rules differ between nations.",
      "Some answers may need to be checked or verified later before anything can be relied on.",
      "You can review and change every answer before you confirm anything.",
    ],
    saveBehaviour:
      "Your progress is kept only in this browser tab while it stays open. It is not saved to an account, and closing the tab loses it.",
  };
}
