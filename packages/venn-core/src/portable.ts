import { geometry, renderSvg, type Envelope } from "./index";

/** Equivalent vector clipping for consumers that support alpha masks only.
 * Keep the browser/legacy renderer unchanged. All geometry is the shared core's.
 */
export function renderPortableSvg(e: Envelope): string {
  const g = geometry(e),
    b = g.box;
  const rectangle = `M${b.x},${b.y}h${b.width}v${b.height}h${-b.width}Z`;
  const clips = g.circles
    .map((c, i) => {
      const ellipse = `M${c.x - c.rx},${c.y}a${c.rx},${c.ry} 0 1 0 ${2 * c.rx},0a${c.rx},${c.ry} 0 1 0 ${-2 * c.rx},0Z`;
      // Opposite winding subtracts the ellipse under the ordinary nonzero rule.
      // CairoSVG does not implement evenodd clip-rule, so no reliance on it here.
      return `<clipPath id="vn-portable-in-${i}"><ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="${c.ry}"/></clipPath><clipPath id="vn-portable-out-${i}"><path d="${rectangle}${ellipse}"/></clipPath>`;
    })
    .join("");
  return renderSvg(e)
    .replace(/<mask\b[\s\S]*?<\/mask>/g, "")
    .replace("</defs>", `${clips}</defs>`)
    .replace(
      /(<rect\b[^>]*?)\s+mask="url\(#vn-mask-(\d)\)"\/>/g,
      (_match, rect: string, raw: string) => {
        const mask = Number(raw);
        let art = `${rect}/>`;
        for (let i = 0; i < g.circles.length; i++)
          art = `<g clip-path="url(#vn-portable-${mask & (1 << i) ? "in" : "out"}-${i})">${art}</g>`;
        return art;
      },
    );
}
