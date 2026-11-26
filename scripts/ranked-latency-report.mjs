import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const actions = new Set(["reveal", "flag", "chord"]);
const metrics = ["total", "app", "auth", "db", "outsideApp", "wait", "receive"];
const valid = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function summarizeRankedHar(har, origin) {
  const groups = new Map();
  for (const entry of har?.log?.entries ?? []) {
    let url;
    try {
      url = new URL(entry.request?.url);
    } catch {
      continue;
    }
    if (url.origin !== origin || entry.request?.method !== "POST") continue;
    const action = url.pathname.split("/").at(-1);
    if (!actions.has(action) || url.pathname !== `/api/ranked/matches/${action}`)
      continue;
    const group = groups.get(action) ?? { successes: [], failures: 0 };
    groups.set(action, group);
    if (!(entry.response?.status >= 200 && entry.response.status < 300)) {
      group.failures++;
      continue;
    }
    const row = {
      total: entry.time,
      wait: entry.timings?.wait,
      receive: entry.timings?.receive,
    };
    for (const header of entry.response?.headers ?? []) {
      if (String(header.name).toLowerCase() !== "server-timing") continue;
      for (const part of String(header.value).split(",")) {
        const match = /^\s*(app|auth|db)\s*;\s*dur=(\d+(?:\.\d+)?)\s*(?:;.*)?$/.exec(
          part,
        );
        if (match) row[match[1]] = Number(match[2]);
      }
    }
    if (valid(row.total) && valid(row.app))
      row.outsideApp = Math.max(0, row.total - row.app);
    group.successes.push(row);
  }
  const round = (n) => Math.round(n * 10) / 10;
  return [...groups.entries()].map(([action, group]) => ({
    action,
    successes: group.successes.length,
    failures: group.failures,
    milliseconds: Object.fromEntries(
      metrics.map((key) => {
        const values = group.successes
          .map((row) => row[key])
          .filter(valid)
          .sort((a, b) => a - b);
        const n = values.length;
        if (!n) return [key, null];
        const middle =
          n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
        return [
          key,
          {
            n,
            mean: round(values.reduce((a, b) => a + b, 0) / n),
            p50: round(middle),
            p95: round(values[Math.ceil(n * 0.95) - 1]),
          },
        ];
      }),
    ),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, target, ...extra] = process.argv.slice(2);
    if (!file || !target || extra.length) throw new Error("usage");
    const origin = new URL(target).origin;
    const summary = summarizeRankedHar(JSON.parse(readFileSync(file, "utf8")), origin);
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      "outsideApp includes network, platform and browser overhead; it is not pure network latency. Rendering is not measured by HAR.",
    );
    if (!summary.length) process.exitCode = 1;
  } catch {
    console.error(
      "Usage: node scripts/ranked-latency-report.mjs <local.har> <site-origin> (valid HAR required). No raw request data is printed.",
    );
    process.exitCode = 1;
  }
}
