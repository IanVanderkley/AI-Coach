# Competitive rank emblem artwork

The eight WebP assets are extracted from the approved AI-generated concept poster (MindSweeper Competitive Rank Showcase(1).png), not simplified vector redraws. Backgrounds were isolated, edges antialiased and the badges placed on a common transparent canvas. Original poster crops are relatively small; the 640px canvases use resampled artwork, not newly generated native high-resolution details. WebP encoding uses high quality and a full-quality alpha channel. Artwork is intended for the dark game UI.

## Rendering contract

- Assets: `public/ranks/{copper,bronze,silver,gold,platinum,emerald,diamond,omniscient}.webp`.
- Common canvas: 640 × 640 pixels. Nominal mine center: (320, 350), or (50%, 54.6875%). The original image centers are approximate; verify visually when adding numerals.
- No baked-in labels or Roman numerals. Numbered ranks use the division from `competitiveRank`. Omniscient has no numeral.
- Preserve canvas aspect ratio when displaying; use the same square container for the image and numeral overlay.
- Higher ranks deliberately occupy more of the canvas. Do not scale each asset to fill independently.
- Provide the rank label as accessible text in the consuming component. Do not rely on color alone.

Batch 23C adds assets, asset contract tests and this documentation only. No UI or database changes are included. Integration and dynamic Roman numerals are separate patches.
