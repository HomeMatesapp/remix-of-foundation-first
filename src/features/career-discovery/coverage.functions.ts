import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * App-internal server boundary for Increment 13 coverage resolution.
 *
 * It exists purely because the governance content-hash authority is server-side.
 * It performs no database access, no authentication, no external network call
 * and no writes: it reads frozen in-repo canonical content only.
 */
export const getRoleAssessmentAvailability = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({ occupationKey: z.string().min(1) })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [{ resolveRoleAssessmentAvailability }, occupations, packs] = await Promise.all([
      import("./coverage.server"),
      import("../../content/occupations/architecture-tests"),
      import("../../content/career-packs/architecture-tests"),
    ]);

    return resolveRoleAssessmentAvailability({
      occupationKey: data.occupationKey,
      universe: occupations.ARCHITECTURE_TEST_OCCUPATIONS,
      packs: packs.ARCHITECTURE_TEST_PACKS,
    });
  });

/**
 * EXACT Reality Check pack binding, established server-side.
 *
 * It lives in the SAME single app-internal boundary and adds no new authority:
 * it returns the canonical Career Pack document only when its recomputed
 * content hash matches the Increment 13 coverage ref exactly.
 */
export const getRealityCheckPackBinding = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({ occupationKey: z.string().min(1) })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [{ resolveRealityCheckPackBinding }, occupations, packs] = await Promise.all([
      import("./coverage.server"),
      import("../../content/occupations/architecture-tests"),
      import("../../content/career-packs/architecture-tests"),
    ]);

    return resolveRealityCheckPackBinding({
      occupationKey: data.occupationKey,
      universe: occupations.ARCHITECTURE_TEST_OCCUPATIONS,
      packs: packs.ARCHITECTURE_TEST_PACKS,
    });
  });
