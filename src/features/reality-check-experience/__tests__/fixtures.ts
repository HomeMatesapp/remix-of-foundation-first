import type { CareerPack } from "../../../domain/career-packs";
import type { QuestionDefinition } from "../../../domain/questions";

/**
 * Synthetic flow fixtures.
 *
 * Test-only structures used to prove generic behaviour (all seven input kinds and
 * multi-level dependency chains) that the four real architecture-test packs do
 * not happen to exercise. They are never content and never leave the tests.
 */

export function syntheticPack(
  modules: readonly {
    readonly moduleCode: string;
    readonly questions: readonly QuestionDefinition[];
  }[],
  overrides: {
    readonly careerPackId?: string;
    readonly version?: string;
    readonly occupationKey?: string;
  } = {},
): CareerPack {
  return {
    careerPackId: overrides.careerPackId ?? "11111111-1111-4111-8111-111111111111",
    version: overrides.version ?? "1.0.0",
    occupation: { occupationKey: overrides.occupationKey ?? "synthetic_role" },
    questionModules: modules.map((module) => ({
      moduleCode: module.moduleCode,
      frameworkVersion: "1.0.0",
      questions: module.questions,
    })),
  } as unknown as CareerPack;
}

export const ALL_KIND_QUESTIONS: readonly QuestionDefinition[] = [
  {
    questionKey: "flag",
    moduleCode: "driving",
    input: { kind: "boolean" },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "single",
    moduleCode: "driving",
    input: { kind: "single_select", optionKeys: ["a", "b"] },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "multi",
    moduleCode: "driving",
    input: { kind: "multi_select", optionKeys: ["a", "b", "c"] },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "count",
    moduleCode: "driving",
    input: { kind: "integer", min: 0, max: 10, unitKey: "years" },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "amount",
    moduleCode: "driving",
    input: { kind: "decimal", min: 0, max: 100 },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "note",
    moduleCode: "driving",
    input: { kind: "text", minLength: 2, maxLength: 40 },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "day",
    moduleCode: "driving",
    input: { kind: "date" },
    consequences: ["practical_fit"],
  },
] as QuestionDefinition[];

/** Three-level dependency chain: root -> level_two -> level_three. */
export const CHAIN_QUESTIONS: readonly QuestionDefinition[] = [
  {
    questionKey: "root",
    moduleCode: "experience",
    input: { kind: "single_select", optionKeys: ["yes", "no"] },
    consequences: ["practical_fit"],
  },
  {
    questionKey: "level_two",
    moduleCode: "experience",
    input: { kind: "single_select", optionKeys: ["yes", "no"] },
    consequences: ["practical_fit"],
    dependency: {
      question: { moduleCode: "experience", questionKey: "root" },
      operator: "equals",
      value: "yes",
    },
  },
  {
    questionKey: "level_three",
    moduleCode: "experience",
    input: { kind: "integer", min: 0, max: 5 },
    consequences: ["practical_fit"],
    dependency: {
      question: { moduleCode: "experience", questionKey: "level_two" },
      operator: "equals",
      value: "yes",
    },
  },
  {
    questionKey: "always",
    moduleCode: "experience",
    input: { kind: "single_select", optionKeys: ["ok"] },
    consequences: ["practical_fit"],
  },
] as QuestionDefinition[];
