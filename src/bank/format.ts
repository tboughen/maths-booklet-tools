/** A question, mark, paper or code count as teachers read it, with thousands separators (2,375). */
export function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}
