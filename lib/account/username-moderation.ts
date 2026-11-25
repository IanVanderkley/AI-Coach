// English username moderation. Keep the SQL policy and parity tests in sync.
export const USERNAME_CONTENT_ERROR =
  "Choose a username without profanity, slurs or hateful language.";
export const BLOCKED_SUBSTRINGS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "asshole",
  "arsehole",
  "dickhead",
  "cockhead",
  "dickface",
  "cocksucker",
  "dickwad",
  "dumbass",
  "jackass",
  "smartass",
  "piss",
  "bollocks",
  "bastard",
  "wanker",
  "nigger",
  "nigga",
  "faggot",
  "fagot",
  "kike",
  "chink",
  "wetback",
  "gook",
  "raghead",
  "towelhead",
  "sandnigger",
  "tranny",
  "retard",
  "beaner",
  "zipperhead",
  "heilhitler",
  "whitepower",
] as const;
export const BLOCKED_TOKENS = [
  "ass",
  "arse",
  "damn",
  "hell",
  "dick",
  "cock",
  "tit",
  "tits",
  "twat",
  "fag",
  "homo",
  "jap",
  "spic",
  "coon",
  "dyke",
  "nazi",
  "wop",
  "paki",
  "chode",
  "prick",
] as const;
const collapse = (value: string) => value.replace(/(.)\1+/g, "$1");
const translate = (value: string, one: string) =>
  value.replace(/[01345789]/g, (digit) => `o${one}eastbg`["01345789".indexOf(digit)]!);

export function usernameContentProblem(username: string): string | null {
  const raw = username.toLowerCase();
  const compact = raw.replace(/_/g, "");
  for (const variant of [compact, translate(compact, "i"), translate(compact, "l")]) {
    if (
      BLOCKED_SUBSTRINGS.some(
        (word) => variant.includes(word) || collapse(variant).includes(collapse(word)),
      )
    )
      return USERNAME_CONTENT_ERROR;
  }
  // Short ambiguous words use token matching to avoid blocking names such as Classic69.
  for (const part of [...raw.split(/_+/), compact]) {
    const stripped = part.replace(/^\d+|\d+$/g, "");
    for (const variant of [
      stripped,
      translate(stripped, "i"),
      translate(stripped, "l"),
    ]) {
      if (
        BLOCKED_TOKENS.some(
          (word) => variant === word || collapse(variant) === collapse(word),
        )
      )
        return USERNAME_CONTENT_ERROR;
    }
  }
  return null;
}
