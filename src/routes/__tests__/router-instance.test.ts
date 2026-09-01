import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Single-router-instance guard.
 *
 * `<Link>` calls `useLinkProps` -> `useRouter`, which throws when it reads a
 * DIFFERENT React context object than the one `RouterProvider` filled. Two
 * installed copies of `@tanstack/react-router` (or `@tanstack/router-core`,
 * which owns the context) produce exactly that, and the symptom is a blank
 * screen. This proves one copy of each is installed and that every TanStack
 * package in the graph depends on that same single version.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");

function installedCopies(pkg: string): string[] {
  const out = execFileSync(
    "find",
    ["node_modules", "-path", `*@tanstack/${pkg}/package.json`, "-not", "-path", "*/dist/*"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

function version(pkg: string): string {
  const raw = readFileSync(join(ROOT, "node_modules", "@tanstack", pkg, "package.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

function tanstackDeps(pkg: string): Record<string, string> {
  const raw = readFileSync(join(ROOT, "node_modules", "@tanstack", pkg, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { dependencies?: Record<string, string> };
  return parsed.dependencies ?? {};
}

const CONSUMERS = [
  "react-start",
  "react-start-client",
  "react-start-server",
  "start-client-core",
  "start-plugin-core",
  "router-plugin",
  "react-router",
] as const;

describe("router context instance", () => {
  it("installs exactly one copy of the router and its core", () => {
    expect(installedCopies("react-router")).toHaveLength(1);
    expect(installedCopies("router-core")).toHaveLength(1);
  });

  it("has every TanStack package agree on that single router version", () => {
    const router = version("react-router");
    const core = version("router-core");
    for (const pkg of CONSUMERS) {
      const deps = tanstackDeps(pkg);
      const declaredRouter = deps["@tanstack/react-router"];
      const declaredCore = deps["@tanstack/router-core"];
      if (declaredRouter) {
        expect(declaredRouter.replace(/^[\^~]/, ""), `${pkg} -> react-router`).toBe(router);
      }
      if (declaredCore) {
        expect(declaredCore.replace(/^[\^~]/, ""), `${pkg} -> router-core`).toBe(core);
      }
    }
  });
});
