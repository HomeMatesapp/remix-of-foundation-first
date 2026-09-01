import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Increment 16 — thin app-internal server boundary for Reality Check evaluation.
 *
 * This module declares the server function ONLY. Every runtime helper, content
 * import and evaluation step lives in imported modules, so server-function
 * splitting can never strip a sibling declaration out from under the handler.
 *
 * It performs no database access, no authentication, no writes, no external
 * network call and no persistence. It reads frozen in-repo canonical content,
 * re-derives the answer set and returns the Decision Engine's own output.
 */

const answerValueSchema = z.union([
  z.string().min(1).max(200),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().min(1).max(200)).max(24),
]);

const answerEntrySchema = z
  .object({
    question: z
      .object({
        moduleCode: z.string().min(1).max(80),
        questionKey: z.string().min(1).max(80),
      })
      .strict(),
    value: answerValueSchema,
  })
  .strict();

const evaluationInputSchema = z
  .object({
    occupationKey: z.string().min(1).max(80),
    /** The pack the client believes it answered. Verified server-side. */
    pack: z
      .object({
        careerPackId: z.string().uuid(),
        version: z.string().min(1).max(32),
        contentHash: z.string().length(64),
      })
      .strict(),
    answers: z.array(answerEntrySchema).min(1).max(200),
  })
  .strict();

export const evaluateRealityCheckAnswers = createServerFn({ method: "POST" })
  .inputValidator((data) => evaluationInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [
      { evaluateConfirmedRealityCheck },
      { resolveRealityCheckPackBinding },
      occupations,
      packs,
    ] = await Promise.all([
      import("./evaluation.server"),
      import("../career-discovery/coverage.server"),
      import("../../content/occupations/architecture-tests"),
      import("../../content/career-packs/architecture-tests"),
    ]);

    const binding = resolveRealityCheckPackBinding({
      occupationKey: data.occupationKey,
      universe: occupations.ARCHITECTURE_TEST_OCCUPATIONS,
      packs: packs.ARCHITECTURE_TEST_PACKS,
    });

    return evaluateConfirmedRealityCheck({
      occupationKey: data.occupationKey,
      declaredPack: data.pack,
      answers: data.answers,
      /* The engine never reads a clock; the instant is supplied here. */
      evaluatedAt: new Date().toISOString(),
      binding,
    });
  });
