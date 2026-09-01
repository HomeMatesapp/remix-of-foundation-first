import {
  QUESTION_MODULE_CODES,
  QUESTION_MODULE_FRAMEWORK_VERSION,
  type QuestionModuleCode,
} from "./codes";
import {
  questionModuleDescriptorSchema,
  type QuestionModuleDescriptor,
  type QuestionModuleRef,
} from "./schema";

/**
 * Governed module catalogue: the module CATEGORIES that exist at this framework
 * version. It deliberately contains no invented participant questions.
 *
 * Frozen so that callers cannot mutate canonical state in a way that affects
 * later reads.
 */
const DESCRIPTORS: readonly QuestionModuleDescriptor[] = Object.freeze(
  QUESTION_MODULE_CODES.map((moduleCode) =>
    Object.freeze(
      questionModuleDescriptorSchema.parse({
        moduleCode,
        frameworkVersion: QUESTION_MODULE_FRAMEWORK_VERSION,
      }),
    ),
  ),
);

const byCode = new Map<QuestionModuleCode, QuestionModuleDescriptor>();
for (const descriptor of DESCRIPTORS) {
  if (byCode.has(descriptor.moduleCode)) {
    throw new Error(`duplicate question module code: ${descriptor.moduleCode}`);
  }
  byCode.set(descriptor.moduleCode, descriptor);
}

/** All governed module categories, in stable catalogue order. */
export function listQuestionModules(): readonly QuestionModuleDescriptor[] {
  return DESCRIPTORS;
}

/**
 * Exact resolution by code + framework version. Returns `undefined` for an
 * unknown code or a version that is not the current framework version.
 */
export function resolveQuestionModule(
  moduleCode: string,
  frameworkVersion: string,
): QuestionModuleDescriptor | undefined {
  const descriptor = byCode.get(moduleCode as QuestionModuleCode);
  if (!descriptor || descriptor.frameworkVersion !== frameworkVersion) return undefined;
  return descriptor;
}

/** Whether a module reference resolves exactly. */
export function isKnownQuestionModuleRef(ref: QuestionModuleRef): boolean {
  return resolveQuestionModule(ref.moduleCode, ref.frameworkVersion) !== undefined;
}
