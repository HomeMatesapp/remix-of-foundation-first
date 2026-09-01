export * from "./sources";
export { REGISTERED_NURSE_PACK } from "./registered-nurse";
export { ELECTRICIAN_PACK } from "./electrician";
export { SOLICITOR_ENGLAND_WALES_PACK } from "./solicitor-england-wales";
export { PHOTOGRAPHER_PACK } from "./photographer";

import type { CareerPack } from "../../../domain/career-packs";
import { REGISTERED_NURSE_PACK } from "./registered-nurse";
import { ELECTRICIAN_PACK } from "./electrician";
import { SOLICITOR_ENGLAND_WALES_PACK } from "./solicitor-england-wales";
import { PHOTOGRAPHER_PACK } from "./photographer";

/**
 * The four architecture-test Career Packs, in a stable order.
 *
 * Architecture-test content only: these packs are NOT published, NOT a career
 * catalogue and NOT participant UI content.
 */
export const ARCHITECTURE_TEST_PACKS: readonly CareerPack[] = Object.freeze([
  REGISTERED_NURSE_PACK,
  ELECTRICIAN_PACK,
  SOLICITOR_ENGLAND_WALES_PACK,
  PHOTOGRAPHER_PACK,
]);
