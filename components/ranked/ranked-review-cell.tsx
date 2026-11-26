import { Bomb, Check, Flag, X } from "lucide-react";
import { reviewRankedCell, type RankedBoardReview } from "@/lib/ranked/board-review";

const numberClasses = [
  "",
  "number-one",
  "number-two",
  "number-three",
  "number-four",
  "number-five",
  "number-six",
  "number-seven",
  "number-eight",
];

export function RankedReviewCell({
  review,
  index,
  flagged,
}: {
  review: RankedBoardReview;
  index: number;
  flagged: boolean;
}) {
  const { kind, number } = reviewRankedCell(review, index, flagged);
  const row = Math.floor(index / review.columns) + 1;
  const column = (index % review.columns) + 1;
  const safeDescription = `${number ?? 0} adjacent mines`;
  const descriptions = {
    hit: "Mine that ended the game",
    mine: "Mine, not flagged",
    "correct-flag": "Correctly flagged mine",
    "wrong-flag": `Incorrect flag, safe square, ${safeDescription}`,
    opened: `Revealed safe square, ${safeDescription}`,
    unopened: `Previously covered safe square, ${safeDescription}`,
  };
  return (
    <div
      role="gridcell"
      aria-rowindex={row}
      aria-colindex={column}
      aria-label={`Row ${row}, column ${column}, ${descriptions[kind]}`}
      title={descriptions[kind]}
      className={`cell ranked-review-cell ${kind === "hit" ? "mine-exploded" : ""} ${kind === "opened" && number !== null ? numberClasses[number] : ""}`}
      data-review-kind={kind}
    >
      {kind === "hit" || kind === "mine" ? (
        <Bomb aria-hidden="true" />
      ) : kind === "correct-flag" || kind === "wrong-flag" ? (
        <>
          <Flag aria-hidden="true" fill="currentColor" />
          {kind === "correct-flag" ? (
            <Check className="ranked-review-mark" aria-hidden="true" />
          ) : (
            <X className="ranked-review-mark" aria-hidden="true" />
          )}
        </>
      ) : number ? (
        number
      ) : kind === "unopened" ? (
        "·"
      ) : null}
    </div>
  );
}

export function RankedReviewLegend() {
  return (
    <div className="ranked-review-legend" aria-label="Completed board legend">
      <span>
        <Bomb aria-hidden="true" /> Mine
      </span>
      <span data-review-kind="hit">
        <Bomb aria-hidden="true" /> Mine hit
      </span>
      <span data-review-kind="correct-flag">
        <Check aria-hidden="true" /> Correct flag
      </span>
      <span data-review-kind="wrong-flag">
        <X aria-hidden="true" /> Incorrect flag
      </span>
      <span data-review-kind="unopened">··· Previously covered safe square</span>
    </div>
  );
}
