import { evaluateDependencyRule, type AnswerMap } from "./dependency";
import type { QuestionDefinition } from "./schema";

/**
 * Whether a question should currently be ASKED.
 *
 * Visibility only. This never expresses whether a requirement is met, whether a
 * route is available or whether a career is realistic.
 */
export function isQuestionAsked(question: QuestionDefinition, answers: AnswerMap): boolean {
  if (!question.dependency) return true;
  return evaluateDependencyRule(question.dependency, answers);
}
