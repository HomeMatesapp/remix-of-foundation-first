/**
 * Increment 17 Stage C — participant Local Reality interaction surface.
 *
 * Browser-safe. No database, migration, PostGIS, coordinate, geographic
 * computation, geocoding, network, external provider, AI or persistence path.
 *
 * Public barrel scope: participant-safe presentation surfaces only. Raw
 * postcode collection, normalisation, controller state and hand-off internals
 * (`./postcode`, `./collection`) stay internal to the collection component
 * boundary and are deliberately NOT re-exported here.
 */
export * from "./copy";
export * from "./view-model";
