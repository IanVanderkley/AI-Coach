# Batch 24 — Gameplay presentation and bounded performance review

This patch changes the visual HUD, animation timing, visible branding and display clocks. No new dependencies, database migrations, authentication changes or changes to Ranked scoring, the queue, API authorization, or server authority are required.

Ranked timing: the server starts the clock at the first reveal and includes time away from the game. The existing recovery response contains `startedAt`. The HUD uses that timestamp and the HTTP Date header for an approximate elapsed time; the first reveal uses a request midpoint estimate until recovery. The final result remains the server's `durationMs`. The clock never submits data to the server or reads hidden mines. HTTP Date is only second-precision, and the browser clock can be affected by sleep. Do not interpret this HUD estimate as a verified result. If the header is unavailable, the recovered active timer shows a dash instead of inventing a value. Changing abandonment/paused Ranked time is a separate competitive policy decision, not part of this patch.

Practice completion uses the final recorded move timestamp rather than delayed effects; backgrounding and pagehide pause and persist the unfinished game. Existing recordings are not rewritten.

## Performance gate

Do not redesign the Ranked network architecture for a few milliseconds. The earlier hosted average was 226.3 ms, before the final session guard. Measure again using actual normal play, not a synthetic load on the hosted database. Capture at least 30 successful moves across several matches, including reveal, flag and chord; record warm/cold conditions, network and device. In browser DevTools Network export a sanitized HAR locally. Do not share a HAR; it can contain credentials and gameplay data even when sanitized. Run:

```bash
node scripts/ranked-latency-report.mjs /path/to/local.har https://mindsweepercoach.com
```

The report contains only numeric summaries per action and failed request counts. `app`, `auth`, and `db` come from existing Server-Timing values. `db` includes RPC/network overhead, not solely SQL time. `outsideApp` is total minus app and includes network, browser and hosting overhead. HAR does not measure React rendering. Use the browser Performance panel to compare click-to-paint and main-thread work for Practice and Ranked. Report sample size, p50, p95 and mean. Compare like for like. Pursue a larger optimization only if measurements suggest a credible approximately 50% improvement (or an obvious low-risk fix); otherwise defer. No new requests are introduced by the timer or benchmark.

## Local acceptance before deployment

- Verify the navbar reads MindSweeper and the browser title uses the new branding.
- Check Beginner, Intermediate and Expert Practice at 1920x1080, 1440x900, 1280x720 and phone sizes. Use actual viewport sizes, not monitor resolutions. Keep independent scrolling where needed; no inaccessible cells. Check keyboard focus, flags, chords, new game, pause and recovery.
- Check Ranked at the same sizes, including queued actions and Cancel queued. Confirm the first reveal starts an estimated timer, resume includes time away, completed time equals the server result, and the timer never changes ratings or rewards.
- Win and lose in both modes; verify the 4.2-second explosion and approximately 3.6-second victory effects, dismiss/play again during animations, and reduced motion. Verify XP, Elo and replay integrity. Test genuine winning chords separately.
- Verify Practice completion timestamps and saved games after backgrounding, pagehide, refresh and resuming. Verify no duplicate saves. Run all automated tests and a local production build; run local Ranked HTTP smoke and revocation tests if changing any gameplay contract.
- Keep paid AI disabled. Do not push to the live branch before reviewing the patch and manual acceptance results.
