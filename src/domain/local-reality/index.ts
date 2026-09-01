/**
 * Local Reality snapshot contract (Increment 17, Stage A).
 *
 * Browser-safe surface only. Server-authority hashing lives in `./hash` and is
 * deliberately NOT re-exported here so `node:crypto` never reaches the schema
 * surface.
 */
export * from "./codes";
export * from "./canonical";
export * from "./schema";
export * from "./resolve";
