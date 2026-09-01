/* eslint-disable @typescript-eslint/no-explicit-any */
import { basePack } from "../../career-packs/__tests__/fixtures";
import type { GovernanceActorContext } from "../schema";

/** SYNTHETIC governance actors and packs only. No real career content. */

export const AUTHOR_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
export const REVIEWER_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
export const APPROVER_ID = "cccccccc-3333-4333-8333-cccccccccccc";
export const RECORD_ID = "dddddddd-4444-4444-8444-dddddddddddd";

export const author: GovernanceActorContext = {
  internalUserId: AUTHOR_ID,
  roles: ["editor"],
};
export const reviewer: GovernanceActorContext = {
  internalUserId: REVIEWER_ID,
  roles: ["reviewer"],
};
export const approver: GovernanceActorContext = {
  internalUserId: APPROVER_ID,
  roles: ["approver"],
};
export const viewer: GovernanceActorContext = {
  internalUserId: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
  roles: ["viewer"],
};
export function admin(internalUserId: string): GovernanceActorContext {
  return { internalUserId, roles: ["admin"] };
}

export const AUTHORED_AT = "2026-01-01T00:00:00Z";
export const REVIEWED_AT = "2026-01-02T00:00:00Z";
export const APPROVED_AT = "2026-01-03T00:00:00Z";
export const PUBLISHED_AT = "2026-01-04T00:00:00Z";
export const WITHDRAWN_AT = "2026-01-05T00:00:00Z";
export const RUN_AT = "2026-01-02T12:00:00Z";
export const ENGINE_VERSION = "1.0.0";

export function packInput(mutate?: (pack: any) => void): Record<string, unknown> {
  const pack = basePack();
  if (mutate) mutate(pack as Record<string, any>);
  return pack;
}
