import { EMBLEM_CANVAS, rankEmblemModel } from "@/lib/leaderboard/rank-emblem";

type RankEmblemProps = {
  rating: number;
  policyVersion?: 3 | 4;
  size?: number;
  className?: string;
  /** False for tier-only milestones on the rank journey. */
  showDivision?: boolean;
  /** True only when adjacent visible text already describes this emblem. */
  decorative?: boolean;
};

/** Original WebP art plus a centred, resolution-independent Roman numeral. */
export function RankEmblem({
  rating,
  policyVersion = 3,
  size = 128,
  className,
  showDivision = true,
  decorative = false,
}: RankEmblemProps) {
  const emblem = policyVersion === 4
    ? rankEmblemModel(rating, showDivision, 4)
    : rankEmblemModel(rating, showDivision);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${EMBLEM_CANVAS} ${EMBLEM_CANVAS}`}
      style={{ display: "block", maxWidth: "100%", height: "auto", flexShrink: 0 }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : emblem.label}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <image href={emblem.src} width={EMBLEM_CANVAS} height={EMBLEM_CANVAS} />
      {emblem.glyphs.length > 0 && (
        <g
          fill="#fff1df"
          stroke="#24151c"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke fill"
          aria-hidden="true"
        >
          {emblem.glyphs.map((glyph) => (
            <path
              key={glyph.x}
              d={glyph.path}
              transform={`translate(${glyph.x} ${glyph.y})`}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
