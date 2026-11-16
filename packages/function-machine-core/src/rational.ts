/** Exact numbers for function machines: whole numbers, decimals and fractions, never rounded. */
export type Q = { n: bigint; d: bigint };

const abs = (x: bigint) => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
export function q(n: bigint, d = 1n): Q {
  if (d === 0n) throw Error("Division by zero.");
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;

/** Reads -3, 2.5, 3/4, −1 1/2 (a mixed number) or 0.125; null for anything else. */
export function parse(text: string): Q | null {
  const t = text.trim().replace(/−/g, "-").replace(/,/g, "");
  let m = t.match(/^(-?)(\d{1,9})\s+(\d{1,6})\s*\/\s*(\d{1,6})$/);
  if (m) {
    const whole = q(BigInt(m[2]) * BigInt(m[4]) + BigInt(m[3]), BigInt(m[4]));
    return m[1] ? q(-whole.n, whole.d) : whole;
  }
  m = t.match(/^(-?\d{1,9})\s*\/\s*(\d{1,6})$/);
  if (m) return BigInt(m[2]) === 0n ? null : q(BigInt(m[1]), BigInt(m[2]));
  m = t.match(/^(-?)(\d{0,12})(?:\.(\d{1,8}))?$/);
  if (m && (m[2] || m[3])) {
    const frac = m[3] ?? "";
    const value = q(BigInt((m[2] || "0") + frac), 10n ** BigInt(frac.length));
    return m[1] ? q(-value.n, value.d) : value;
  }
  return null;
}
/** A whole number, an exact decimal (up to 6 places), otherwise a fraction such as 7/3. */
export function format(x: Q): string {
  const sign = x.n < 0n ? "−" : "";
  const n = abs(x.n);
  if (x.d === 1n) return sign + n;
  let d = x.d,
    twos = 0,
    fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  const places = Math.max(twos, fives);
  if (d === 1n && places <= 6) {
    const scaled = (n * 10n ** BigInt(places)) / x.d;
    const s = scaled.toString().padStart(places + 1, "0");
    return `${sign}${s.slice(0, -places)}.${s.slice(-places)}`;
  }
  return `${sign}${n}/${x.d}`;
}
