import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8");

test("global footer is shared and links to implemented FAQ sections", () => {
  const layout = read("app/layout.tsx");
  const footer = read("components/ui/site-footer.tsx");
  const faq = read("app/faq/page.tsx");
  assert.match(layout, /\{children\}\s*<SiteFooter\s*\/>/);
  assert.equal((layout.match(/<SiteFooter\s*\/>/g) ?? []).length, 1);
  assert.match(layout, /site-help\.css/);
  for (const href of ["/faq", "/faq#ranked", "/faq#privacy", "/faq#about"]) {
    assert.ok(footer.includes(`href="${href}"`));
    if (href.includes("#")) assert.ok(faq.includes(`id="${href.split("#")[1]}"`));
  }
  assert.doesNotMatch(read("app/page.tsx"), /<footer className="page-footer"/);
  assert.match(read("components/ranked/ranked-lobby.tsx"), /href="\/faq#ranked"/);
  assert.match(faq, /href="\/ranked\/rating-guide"/);
});

test("FAQ preserves coaching explanations and current policy boundaries", () => {
  const faq = read("app/faq/page.tsx");
  const note = read("docs/FAQ-COACHING-CONTENT.md");
  for (const paragraph of note.split(/\r?\n\r?\n/).filter(p => p.startsWith("60%") || p.startsWith("Move 0"))) assert.ok(faq.includes(paragraph.trim()));
  assert.match(faq, /RANK_TIERS_V4\.map/);
  assert.match(faq, /XP_PER_LEVEL\.toLocaleString/);
  assert.match(faq, /500 per UTC day/);
  assert.match(faq, /<td>350<\/td><td>50<\/td>/);
  assert.match(faq, /exactly one safe square remaining and exactly two equally possible candidates/);
  assert.match(faq, /appear publicly by default/);
  assert.match(faq, /Previously deleted or trimmed games cannot be recovered/);
  assert.match(faq, /<details className="faq-question">/);
  assert.doesNotMatch(faq, /fetch\(|getSupabase|dangerouslySetInnerHTML/);
  const css = read("styles/site-help.css");
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(css, /position:\s*fixed/);
});
