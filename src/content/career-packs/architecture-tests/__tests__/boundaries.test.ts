import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Boundary tests for the architecture-test content package.
 *
 * Content is DATA. It must not reach for UI, SQL, network, environment, clocks,
 * AI generation or geographic implementation.
 */

const contentDir = fileURLToPath(new URL("../", import.meta.url));

function contentFiles(): readonly { readonly name: string; readonly source: string }[] {
  return readdirSync(contentDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ name, source: readFileSync(`${contentDir}${name}`, "utf8") }));
}

const FORBIDDEN: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "react", pattern: /\bfrom\s+["']react/ },
  { label: "tanstack", pattern: /@tanstack\// },
  { label: "server functions", pattern: /createServerFn|createFileRoute/ },
  { label: "supabase", pattern: /supabase/i },
  { label: "sql", pattern: /\b(select|insert|update|delete)\s+(into|from|set)\b/i },
  { label: "network", pattern: /\bfetch\s*\(|XMLHttpRequest|axios|https?:\/\// },
  { label: "filesystem", pattern: /node:fs|node:child_process|readFileSync/ },
  { label: "environment", pattern: /process\.env|import\.meta\.env/ },
  { label: "clock", pattern: /Date\.now|new Date\(/ },
  { label: "randomness", pattern: /Math\.random|randomUUID/ },
  { label: "ai generation", pattern: /\bprompt\b|\bllm\b|openai|anthropic|gemini|completion/i },
  { label: "scores and weights", pattern: /\bweight\b|\bscore\b/i },
  {
    label: "geographic implementation",
    pattern: /postgis|geometry|latitude|longitude|ST_Distance|\bradius\b/i,
  },
];

describe("architecture-test content boundaries", () => {
  it("contains at least the four packs plus the source identity module", () => {
    expect(contentFiles().length).toBeGreaterThanOrEqual(6);
  });

  for (const { label, pattern } of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      for (const file of contentFiles()) {
        expect(pattern.test(file.source), `${file.name} must not contain ${label}`).toBe(false);
      }
    });
  }

  it("imports only the frozen domain packages", () => {
    const allowed =
      /^(\.\.\/)+domain\/(career-packs|questions|contracts)(\/version)?$|^\.\/[a-z-]+$/;
    for (const file of contentFiles()) {
      for (const match of file.source.matchAll(/from\s+"([^"]+)"/g)) {
        expect(allowed.test(match[1]!), `${file.name} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("never imports the Decision Engine into content", () => {
    for (const file of contentFiles()) {
      expect(file.source).not.toContain("decision-engine");
    }
  });
});
