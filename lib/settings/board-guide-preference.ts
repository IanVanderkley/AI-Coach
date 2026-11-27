/** Local interface preference; missing or unavailable storage defaults to visible. */
export const BOARD_GUIDE_KEY = "ai-coach.board-controls-guide.v1";

export function readBoardGuide(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(BOARD_GUIDE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeBoardGuide(storage: Pick<Storage, "setItem"> | undefined, enabled: boolean): boolean {
  if (!storage) return false;
  try {
    storage.setItem(BOARD_GUIDE_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}
