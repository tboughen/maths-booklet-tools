// Word lists shared by maths typesetting (typeset.ts) and the maths-letter font choice (text.ts).

/** Letter runs that stay upright inside a maths token: function names, units, ordinals and times. */
export const UPRIGHT = new Set(["sin", "cos", "tan", "log", "ln", "exp", "min", "max", "mm", "cm", "km", "kg", "mg", "ml", "cl", "mph", "st", "nd", "rd", "th", "am", "pm"]);

/** Short English words that can sit beside an operator in prose ("x = 3 or 4") and stay upright. */
export const WORDS = new Set(["an", "as", "at", "be", "by", "do", "if", "in", "is", "it", "of", "on", "or", "so", "to", "up", "we", "and", "are", "but", "can", "for", "has", "its", "not", "the", "was", "who", "why", "how", "all", "any", "one", "two", "six", "ten"]);

/**
 * Short English words a teacher may put in *italics* for emphasis ("Do *not* use a calculator"):
 * they stay in the prose italic, never the maths letters' serif (N16, 22 Nov 2026).
 */
export const PROSE_WORDS: ReadonlySet<string> = new Set([
  ...WORDS, ...UPRIGHT,
  "go", "he", "me", "my", "no", "us", "add", "big", "box", "buy", "day", "did", "end", "far", "few", "get", "had", "her", "him",
  "his", "key", "let", "may", "new", "now", "odd", "off", "old", "our", "out", "own", "pay", "per", "put", "row", "say", "see",
  "set", "she", "sum", "too", "top", "try", "use", "way", "yes", "yet", "you", "ago", "ask", "each", "both",
]);

