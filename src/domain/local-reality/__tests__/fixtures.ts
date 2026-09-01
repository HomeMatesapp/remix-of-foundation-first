import { LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION } from "../codes";

/** Deterministic literal fixtures. No clock, no randomness, no environment. */

export const SNAPSHOT_ID = "6f6c6361-6c00-4000-8000-000000000001";
export const SOURCE_ID = "6f6c6361-6c00-4000-8000-0000000000a1";
export const PROVIDER_ITEM_ID = "6f6c6361-6c00-4000-8000-000000000101";
export const PROGRAMME_ITEM_ID = "6f6c6361-6c00-4000-8000-000000000102";
export const OPPORTUNITY_ITEM_ID = "6f6c6361-6c00-4000-8000-000000000103";
export const PROVIDER_ID = "6f6c6361-6c00-4000-8000-000000000201";
export const PROGRAMME_ID = "6f6c6361-6c00-4000-8000-000000000202";
export const OPPORTUNITY_ID = "6f6c6361-6c00-4000-8000-000000000203";
export const OCCUPATION_ID = "6f6c6361-6c00-4000-8000-000000000301";

export function providerItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: PROVIDER_ITEM_ID,
    objectType: "provider",
    signalKey: "provider.presence",
    providerId: PROVIDER_ID,
    sourceId: SOURCE_ID,
    sourceRecordKey: "PROV/10001234",
    organisationName: "Sheffield College",
    itemTitle: "Sheffield College",
    approxDistanceMiles: 3.4,
    availabilityConfidenceKey: "source.listed",
    locationLabel: "Sheffield",
    details: [],
    capturedAt: "2026-08-27T09:00:00Z",
    ...overrides,
  };
}

export function programmeItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: PROGRAMME_ITEM_ID,
    objectType: "programme",
    signalKey: "apprenticeship_availability",
    programmeId: PROGRAMME_ID,
    sourceId: SOURCE_ID,
    sourceRecordKey: "PROG/ST0152/2026",
    organisationName: "Sheffield College",
    itemTitle: "Installation and Maintenance Electrician apprenticeship",
    occupationId: OCCUPATION_ID,
    archetypeCode: "apprenticeship",
    routeKey: "route.apprenticeship",
    approxDistanceMiles: 0,
    availabilityConfidenceKey: "source.listed",
    locationLabel: "Sheffield",
    details: [
      { detailKey: "study.mode", detailText: "Day release" },
      { detailKey: "duration", detailText: "Around 4 years" },
    ],
    capturedAt: "2026-08-27T09:00:00Z",
    ...overrides,
  };
}

export function opportunityItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: OPPORTUNITY_ITEM_ID,
    objectType: "opportunity",
    signalKey: "vacancy_availability",
    opportunityId: OPPORTUNITY_ID,
    sourceId: SOURCE_ID,
    sourceRecordKey: "VAC\t000-1#a+bü",
    organisationName: "Northern Electrical Services Ltd",
    itemTitle: "Apprentice electrician",
    approxDistanceMiles: 12.5,
    availabilityConfidenceKey: "source.listed",
    locationLabel: "Rotherham",
    details: [{ detailKey: "closing.date", detailText: "Closes 30 September 2026" }],
    capturedAt: "2026-08-27T09:00:00Z",
    ...overrides,
  };
}

export function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: SNAPSHOT_ID,
    capturedAt: "2026-08-27T09:00:00Z",
    precisionLevel: "sector",
    searchAreaLabel: "Sheffield area",
    approxRadiusMiles: 15,
    transportModeAssumptionKey: "transport.public",
    items: [providerItem(), programmeItem(), opportunityItem()],
    ...overrides,
  };
}
