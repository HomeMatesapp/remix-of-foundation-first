import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Runtime robustness guard for the root route.
 *
 * `notFoundComponent` and `errorComponent` on the ROOT route are the last-resort
 * renderer. They can be rendered while the router context is unavailable (an
 * error thrown during root render or hydration). If they use `<Link>` or a
 * router hook, `useRouter()` throws inside the fallback itself and the document
 * renders blank instead of the error page.
 */

const source = readFileSync(join(import.meta.dirname, "..", "__root.tsx"), "utf8");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const code = stripComments(source);

describe("root route fallbacks", () => {
  it("does not import router hooks or Link into the root module", () => {
    expect(code).not.toMatch(/\buseRouter\b/);
    expect(code).not.toMatch(/\bLink\b/);
  });

  it("keeps both root fallbacks wired", () => {
    expect(code).toContain("notFoundComponent: NotFoundComponent");
    expect(code).toContain("errorComponent: ErrorComponent");
  });

  it("recovers with a context-free reload and plain anchors", () => {
    expect(code).toContain('href="/"');
    expect(code).toContain("window.location.reload()");
  });
});
