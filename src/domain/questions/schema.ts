import { z } from "zod";

import {
  QUESTION_CONSEQUENCE_CODES,
  QUESTION_MODULE_CODES,
  QUESTION_MODULE_FRAMEWORK_VERSION,
} from "./codes";
import { dependencyRuleSchema, questionRefSchema } from "./dependency";
import { questionInputSchema } from "./input";

/**
 * Module and question definition contracts.
 *
 * Structural only. No participant-facing prompt/help/label/section copy, career
 * names, salaries, requirements, evidence claims or actions. No `required`,
 * `blocking`, `severity`, verdict, score, weight or Decision Engine rule fields.
 */

export const questionModuleCodeSchema = z.enum(QUESTION_MODULE_CODES);

export const questionConsequenceCodeSchema = z.enum(QUESTION_CONSEQUENCE_CODES);

/** Exact module reference: code plus the current framework version. */
export const questionModuleRefSchema = z
  .object({
    moduleCode: questionModuleCodeSchema,
    frameworkVersion: z.literal(QUESTION_MODULE_FRAMEWORK_VERSION),
  })
  .strict();
export type QuestionModuleRef = z.infer<typeof questionModuleRefSchema>;

const consequencesSchema = z
  .array(questionConsequenceCodeSchema)
  .min(1, "a question must declare at least one consequential purpose")
  .refine((codes) => new Set(codes).size === codes.length, "consequence codes must be unique");

/**
 * Generic reusable question definition.
 *
 * `consequences` is the enforcement mechanism for the architecture rule that we
 * ask a question only if its answer can alter a consequential outcome. It
 * declares permission to matter later; it contains no evaluation logic.
 */
export const questionDefinitionSchema = z
  .object({
    questionKey: questionRefSchema.shape.questionKey,
    moduleCode: questionModuleCodeSchema,
    input: questionInputSchema,
    consequences: consequencesSchema,
    /** Optional visibility rule: whether this question is asked at all. */
    dependency: dependencyRuleSchema.optional(),
  })
  .strict();
export type QuestionDefinition = z.infer<typeof questionDefinitionSchema>;

/**
 * Reusable module definition. Authored module definitions may be reused by many
 * future Career Packs; this framework does not model that composition.
 *
 * Local contradictions fail closed at parse time: a module cannot own a question
 * declaring a different module code, and question keys must be unique within it.
 */
export const questionModuleDefinitionSchema = z
  .object({
    moduleCode: questionModuleCodeSchema,
    frameworkVersion: z.literal(QUESTION_MODULE_FRAMEWORK_VERSION),
    questions: z
      .array(questionDefinitionSchema)
      .min(1, "a module definition must contain at least one question"),
  })
  .strict()
  .superRefine((module, ctx) => {
    const seen = new Set<string>();
    module.questions.forEach((question, index) => {
      if (question.moduleCode !== module.moduleCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "moduleCode"],
          message: `question declares module ${question.moduleCode} inside ${module.moduleCode}`,
        });
      }
      const address = `${question.moduleCode}:${question.questionKey}`;
      if (seen.has(address)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "questionKey"],
          message: `duplicate question reference ${address} within the module`,
        });
      }
      seen.add(address);
    });
  });
export type QuestionModuleDefinition = z.infer<typeof questionModuleDefinitionSchema>;

/**
 * Catalogue descriptor for a governed module category. A module category exists
 * without any authored questions; reviewed reusable question content arrives
 * later as content, not as framework.
 */
export const questionModuleDescriptorSchema = z
  .object({
    moduleCode: questionModuleCodeSchema,
    frameworkVersion: z.literal(QUESTION_MODULE_FRAMEWORK_VERSION),
  })
  .strict();
export type QuestionModuleDescriptor = z.infer<typeof questionModuleDescriptorSchema>;
