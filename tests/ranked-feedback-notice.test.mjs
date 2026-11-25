import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Ranked recovery notices describe synchronization without replaying a move", () => {
  const page = read("app/ranked/page.tsx");
  assert.equal((page.match(/const recovered = await loadBoard\(\);/g) ?? []).length, 3);
  assert.equal((page.match(/setNotice\(RECOVERED_NOTICE\);/g) ?? []).length, 3);
  assert.match(page, /Board refreshed/);
  assert.match(page, /Refresh Ranked board/);
  assert.doesNotMatch(page, /<p role="alert">\{error\}<\/p>/);
});

test("shared notices use accessible severity and responsive styles", () => {
  const component = read("components/ui/feedback-notice.tsx");
  const css = read("components/ui/feedback-notice.module.css");
  assert.match(component, /tone === "error" \? "alert" : "status"/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  for (const tone of ["success", "warning", "error", "loading"]) {
    assert.ok(css.includes(`.${tone}`));
  }
});
