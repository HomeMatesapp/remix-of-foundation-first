/**
 * Increment 17, Stage D8 — DIACRITIC-REMOVAL MECHANISM record, reconciled at R1.
 *
 * Stage D8 asked ONE bounded question: can a Clear Routes wrapper around the
 * `unaccent` accent-removal mechanism carry a genuinely immutable contract, so
 * that a future `normalise_title()` stored generated-column path is
 * deterministic?
 *
 * The answer, after R1 external inspection, is NO — NOT PROVEN. The original
 * design is preserved here as historical evidence and is explicitly superseded.
 * Nothing is installed, nothing is applied, `normalise_title()` remains
 * unimplemented and every downstream entity remains unauthored.
 *
 * Stage D1–D7 records are untouched and remain frozen history.
 */

/** Version of the Stage D8 record document itself (R1 reconciliation). */
export const LOCAL_REALITY_D8_PROOF_VERSION = "1.1.0" as const;

/** Date the record below was last reconciled (ISO calendar date). */
export const LOCAL_REALITY_D8_PROOF_DATE = "2026-09-01" as const;

/**
 * The owner decision that unblocked the MECHANISM question recorded at Stage D7.
 * It is a CONDITIONAL technical-direction approval, and the condition is NOT
 * satisfied (see `D8_R1_RECONCILIATION`). It authorises no hosted change.
 */
export const D8_OWNER_MECHANISM_APPROVAL = Object.freeze({
  /** Direction approved, conditionally only. */
  approved: true as const,
  conditional: true as const,
  /** The conditionally approved mechanism direction. */
  mechanism: "unaccent" as const,
  /** Condition attached to the approval by the product owner. */
  condition:
    "A deterministic immutable wrapper must be designed and proven BEFORE the mechanism is used by normalise_title()." as const,
  /** R1 outcome: the condition is NOT met, so the direction cannot be acted on. */
  conditionSatisfied: false as const,
  /** Explicitly withheld: installation and application remain ungated. */
  hostedInstallAuthorised: false as const,
  hostedApplyAuthorised: false as const,
  /** No competing accent-removal mechanism is selected or invented here. */
  rejectedAlternatives: Object.freeze([
    "hand-written character or transliteration mapping",
    "ad hoc translate() ladders",
    "any generative or model-derived accent guessing",
    "any client-side or application-layer accent stripping used as the stored truth",
  ] as const),
});

/**
 * Official upstream volatility expectation, recorded exactly. The contrib
 * install script `contrib/unaccent/unaccent--1.1.sql` declares BOTH overloads
 * `LANGUAGE C STABLE STRICT PARALLEL SAFE`.
 */
export const D8_UPSTREAM_VOLATILITY_EXPECTATION = Object.freeze({
  source: "contrib/unaccent/unaccent--1.1.sql" as const,
  overloads: Object.freeze({
    "unaccent(regdictionary, text)": "STABLE" as const,
    "unaccent(text)": "STABLE" as const,
  }),
  declaredProperties: Object.freeze(["STRICT", "PARALLEL SAFE"] as const),
  note: "Neither overload is declared IMMUTABLE upstream. Any wrapper that re-declares an accent-removal call as IMMUTABLE is making an unproven claim, not restating an upstream guarantee." as const,
});

/**
 * The R1 external-inspection reconciliation. Additive: it identifies the exact
 * defects in the superseded design and records the resulting blocked state.
 */
export const D8_R1_RECONCILIATION = Object.freeze({
  reconciledAt: "2026-09-01" as const,
  inspectedCommit: "349378b14ae7df1202f89d8e7bdf655ca8399d26" as const,
  severity: "critical" as const,
  findings: Object.freeze([
    Object.freeze({
      code: "D8_R1_FALSE_UPSTREAM_VOLATILITY" as const,
      defect:
        "The superseded design claimed the dictionary-explicit two-argument accent-removal form is declared IMMUTABLE upstream. That claim is false: the official contrib install script declares both overloads STABLE." as const,
      correction:
        "The recorded upstream expectation for both overloads is STABLE. A wrapper declared IMMUTABLE over either overload is an unproven re-declaration." as const,
    }),
    Object.freeze({
      code: "D8_R1_CIRCULAR_GENERATED_COLUMN_PROOF" as const,
      defect:
        "The superseded design treated a successful stored generated column over the wrapper as server-enforced evidence of immutability." as const,
      correction:
        "That check is circular. The generated-column restriction inspects the DECLARED volatility contract of the function in the generation expression, which the wrapper had already asserted. It cannot establish that the underlying STABLE call is semantically immutable." as const,
    }),
    Object.freeze({
      code: "D8_R1_DICTIONARY_CONTENT_STILL_MUTABLE" as const,
      defect:
        "The superseded design leaned on the frozen dictionary identity as though it removed the determinism risk." as const,
      correction:
        "Freezing the dictionary identity freezes selection, not rules content. The dictionary's rules are external server-side data backed by rules files and alterable through dictionary configuration, so the residual mutability the record already acknowledged remains unresolved under the owner's condition." as const,
    }),
  ] as const),
  /** Retained-only-as-history original artifact, deliberately non-promotable. */
  supersededSourcePath:
    "supabase/authored-migrations/superseded/20260901090000_stage-d8-unaccent-immutable-wrapper-proof.SUPERSEDED-R1.sql.txt" as const,
});

/**
 * The current Stage D8 artifact: a fail-closed BLOCKER, not executable proof
 * DDL. It establishes no extension and creates no wrapper.
 */
export const D8_AUTHORED_MIGRATION_PATH =
  "supabase/authored-migrations/20260901090000_stage-d8-unaccent-mechanism-blocker.sql" as const;

/** Intended ordinal position of the artifact in repository order, unchanged. */
export const D8_AUTHORED_MIGRATION_ORDINAL = 11 as const;

/** The artifact's nature, stated so it cannot be mistaken for an applied proof. */
export const D8_ARTIFACT_KIND = "blocker" as const;

/**
 * The SUPERSEDED wrapper design, retained as historical evidence only. It is NOT
 * an accepted design, is not authored anywhere as executable DDL, and must not
 * be revived without a fresh owner/technical decision.
 */
export const D8_SUPERSEDED_WRAPPER_DESIGN = Object.freeze({
  status: "superseded" as const,
  accepted: false as const,
  wrapperFunction: "public.clear_routes_unaccent(text)" as const,
  extensionSchema: "extensions" as const,
  extensionName: "unaccent" as const,
  underlyingCall: "extensions.unaccent(regdictionary, text)" as const,
  frozenDictionaryLiteral: "'extensions.unaccent'::regdictionary" as const,
  functionSearchPath: "pg_catalog" as const,
  /** What the superseded design DECLARED — not what upstream guarantees. */
  declaredVolatility: "IMMUTABLE" as const,
  declaredVolatilityJustified: false as const,
  rejectionReason:
    "The declared IMMUTABLE contract wrapped a STABLE upstream call, and the only evidence offered for it was circular." as const,
});

/**
 * Dictionary identity reasoning, kept as a USEFUL PROPERTY only. It is not, and
 * was never, sufficient evidence of immutability.
 */
export const D8_DICTIONARY_IDENTITY_PROPERTY = Object.freeze({
  property:
    "A schema-qualified regdictionary literal pins which dictionary an accent-removal call selects, so selection cannot vary with the caller's resolution path, role or session." as const,
  sufficientForImmutability: false as const,
  whyInsufficient:
    "Selection is not content. The selected dictionary's rules remain external server-side data that may be altered, which would change past results for the same input." as const,
});

/**
 * The narrow contract any future accent-removal entry point must keep. Retained
 * as design intent; no such function is authored.
 */
export const D8_WRAPPER_CONTRACT = Object.freeze({
  authored: false as const,
  input: "text" as const,
  output: "text" as const,
  performs: Object.freeze([
    "remove diacritics, exactly as the approved dictionary defines",
  ] as const),
  mustNotPerform: Object.freeze([
    "case folding",
    "punctuation removal",
    "whitespace collapsing or trimming",
    "singularisation",
    "stemming",
    "lemmatisation",
    "any other morphology",
    "any transliteration beyond what the approved dictionary itself defines",
    "any invented character mapping",
  ] as const),
});

/**
 * `normalise_title()` remains UNIMPLEMENTED, and now also UNMECHANISED: the
 * conditionally approved mechanism cannot meet the condition as constrained.
 */
export const D8_NORMALISE_TITLE_STATUS = Object.freeze({
  implemented: false as const,
  mechanismApproved: false as const,
  mechanismDirectionConditionallyApproved: true as const,
  wrapperProvenByAuthoredSource: false as const,
  wrapperAuthored: false as const,
  wrapperApplied: false as const,
  acceptedOperationOrder: Object.freeze([
    "lowercase",
    "remove punctuation",
    "remove diacritics",
    "collapse whitespace",
  ] as const),
  morphologyPermitted: false as const,
  note: "Stage D8 asked only whether the diacritic-removal step could be made genuinely immutable. It could not be proven, so normalise_title() is not authored, no generated occupation column exists, and occupation and everything downstream of it remain unauthored." as const,
});

/** Entities that remain unauthored after Stage D8 R1. Unchanged from Stage D7. */
export const D8_STILL_UNAUTHORISED_ENTITIES: readonly string[] = Object.freeze([
  "normalise_title",
  "occupation",
  "programme",
  "opportunity",
  "local_snapshot_item",
]);

/**
 * The exact final blocker after R1. Stage D8 is NOT closed and the diacritic
 * mechanism question is reopened for an owner/technical decision.
 */
export const D8_FINAL_BLOCKER =
  "The diacritic-removal step cannot be made deterministic through an unaccent wrapper as currently constrained: upstream declares both unaccent overloads STABLE, a stored generated column cannot prove semantic immutability of the wrapped call, and the dictionary's rules content remains external mutable data. The owner's condition for a genuinely immutable wrapper is therefore unmet, so no wrapper may be authored, no extension established, and normalise_title() remains blocked." as const;

/** The only permitted next steps. No mechanism is selected here. */
export const D8_NEXT_SEQUENCE = Object.freeze([
  "External diff inspection of this R1 reconciliation.",
  "A fresh owner/technical decision on how diacritic removal is to be satisfied at all, given that unaccent cannot meet the approved generated-column immutability condition as currently constrained. No replacement mechanism is selected by this stage.",
  "Only after that decision may normalise_title() be reconsidered, and only then may the occupation chain be reassessed.",
] as const);

export interface D8ProofAssessment {
  readonly mechanism: "unaccent";
  readonly ownerApproved: boolean;
  readonly ownerConditionSatisfied: false;
  readonly wrapperDesignProven: false;
  readonly wrapperAuthored: false;
  readonly normaliseTitleImplemented: false;
  readonly downstreamAuthored: false;
  readonly targetProjectVerified: false;
  readonly hostedApplyAuthorised: false;
  readonly blockers: readonly string[];
}

/**
 * Deterministic fail-closed assessment. After R1 the proof is BLOCKED: the
 * blocker list is never empty and `wrapperDesignProven` is always false.
 */
export function assessD8UnaccentWrapperProof(): D8ProofAssessment {
  const blockers: string[] = [D8_FINAL_BLOCKER];

  for (const finding of D8_R1_RECONCILIATION.findings) {
    blockers.push(`${finding.code}: ${finding.correction}`);
  }
  if (D8_UPSTREAM_VOLATILITY_EXPECTATION.overloads["unaccent(regdictionary, text)"] !== "STABLE") {
    blockers.push("Recorded upstream volatility expectation has drifted from STABLE.");
  }
  if (D8_DICTIONARY_IDENTITY_PROPERTY.sufficientForImmutability) {
    blockers.push("Dictionary identity must never be recorded as sufficient immutability proof.");
  }
  if (D8_NORMALISE_TITLE_STATUS.implemented) {
    blockers.push("normalise_title() must not be implemented at this stage.");
  }

  return Object.freeze({
    mechanism: "unaccent" as const,
    ownerApproved: D8_OWNER_MECHANISM_APPROVAL.approved,
    ownerConditionSatisfied: false as const,
    wrapperDesignProven: false as const,
    wrapperAuthored: false as const,
    normaliseTitleImplemented: false as const,
    downstreamAuthored: false as const,
    targetProjectVerified: false as const,
    hostedApplyAuthorised: false as const,
    blockers: Object.freeze(blockers),
  });
}
