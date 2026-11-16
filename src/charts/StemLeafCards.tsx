import type { ReactNode } from "react";
import { STEM_LEAF_MM, stemKeyChoices, stemKeyComplete, stemKeyNames, type StemleafSettings } from "../../packages/chart-core/src";
import { DraftField } from "./DraftField";

const WIDTH_CHOICES = Array.from({ length: (STEM_LEAF_MM.maximum - STEM_LEAF_MM.minimum) / 5 + 1 }, (_, i) => STEM_LEAF_MM.minimum + 5 * i);

/** Settings cards for stem-and-leaf diagrams: the rows, the key and the leaves column. */
export function StemLeafCards({
  s,
  blocked,
  selected,
  issues,
  onChange,
  linesControl,
}: {
  s: StemleafSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: StemleafSettings) => void) => void;
  linesControl: ReactNode;
}) {
  const keyBad = issues.some((x) => x.startsWith("Key:"));
  const bad = (row: number, what: string) => issues.some((x) => x.startsWith(`Row ${row + 1}:`) && x.includes(what));
  const widths = WIDTH_CHOICES.includes(s.leafMm) ? WIDTH_CHOICES : [...WIDTH_CHOICES, s.leafMm].sort((a, b) => a - b);
  return (
    <>
      <section className="panel-card ch-panel">
        <h2>Stems and leaves</h2>
        <div className="ch-table-wrap">
          <table className="ch-table ch-points ch-stems">
            <thead>
              <tr>
                <th scope="col" aria-label="Row">#</th>
                <th scope="col">Stem</th>
                <th scope="col">Leaves</th>
                <th scope="col">Hide</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>
                    <DraftField
                      id={`ch-stem-stem-${i}`}
                      className={selected === `ch-stem-stem-${i}` ? "ch-field-selected" : ""}
                      label={`Row ${i + 1} stem`}
                      value={r.stem}
                      maxLength={6}
                      inputMode="decimal"
                      disabled={blocked}
                      invalid={bad(i, "stem")}
                      onCommit={(v) => onChange((n) => void (n.rows[i].stem = v))}
                    />
                  </td>
                  <td className="ch-leaves">
                    <DraftField
                      id={`ch-stem-leaves-${i}`}
                      className={selected === `ch-stem-leaves-${i}` ? "ch-field-selected" : ""}
                      label={`Row ${i + 1} leaves`}
                      value={r.leaves}
                      maxLength={40}
                      inputMode="decimal"
                      disabled={blocked}
                      invalid={bad(i, "lea")}
                      onCommit={(v) => onChange((n) => void (n.rows[i].leaves = v))}
                    />
                  </td>
                  <td className="ch-class-hide">
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide the stem of row ${i + 1} for pupils`}
                        checked={r.stemShow === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((n) => void (n.rows[i].stemShow = ev.target.checked ? "hidden" : "show"))}
                      />
                      Stem
                    </label>
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide the leaves of row ${i + 1} for pupils`}
                        checked={r.leavesShow === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((n) => void (n.rows[i].leavesShow = ev.target.checked ? "hidden" : "show"))}
                      />
                      Leaves
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ch-note">
          Type each row&apos;s leaves as single digits, with or without spaces. Leaves print as typed, never
          sorted. A blank row is an empty ruled row; a hidden stem or row of leaves is left for pupils
          to complete. Use + and − beside the diagram to add or remove the last row.
        </p>
        <div className="ch-row">
          <button type="button" disabled={blocked} onClick={() => onChange((n) => n.rows.forEach((r) => (r.stemShow = r.leavesShow = "hidden")))}>
            Hide every stem and leaf (pupils draw it)
          </button>
          <button
            type="button"
            disabled={blocked || !(s.rows.some((r) => r.stemShow === "hidden" || r.leavesShow === "hidden") || (s.key.show === "hidden" && stemKeyComplete(s.key)))}
            onClick={() =>
              onChange((n) => {
                n.rows.forEach((r) => (r.stemShow = r.leavesShow = "show"));
                if (n.key.show === "hidden" && stemKeyComplete(n.key)) n.key.show = "show";
              })
            }
          >
            Show all
          </button>
        </div>
      </section>
      <section className="panel-card ch-panel">
        <h2>Key and size</h2>
        <fieldset className="ch-fieldset">
          <legend>Key</legend>
          <div className="ch-fields">
            <label>
              Stem
              <DraftField label="Key stem" invalid={keyBad} value={s.key.stem} maxLength={6} inputMode="decimal" disabled={blocked} onCommit={(v) => onChange((n) => void (n.key.stem = v))} />
            </label>
            <label>
              Leaf
              <DraftField label="Key leaf" invalid={keyBad} value={s.key.leaf} maxLength={1} inputMode="decimal" disabled={blocked} onCommit={(v) => onChange((n) => void (n.key.leaf = v))} />
            </label>
            <label className="ch-wide">
              Represents
              <DraftField label="Key represents" invalid={keyBad} value={s.key.represents} maxLength={32} disabled={blocked} onCommit={(v) => onChange((n) => void (n.key.represents = v))} />
            </label>
            <label className="ch-wide">
              Key for pupils
              <select aria-label="Key for pupils" value={s.key.show} disabled={blocked} onChange={(ev) => onChange((n) => void (n.key.show = ev.target.value as StemleafSettings["key"]["show"]))}>
                {stemKeyChoices.map((x) => (
                  <option key={x} value={x}>
                    {stemKeyNames[x]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <p className="ch-note">The key prints as Key: 1 | 2 represents 12 points. An empty box keeps your key as the answer.</p>
        <div className="ch-fields">
          <label>
            Leaves column (mm)
            <select aria-label="Leaves column width" value={s.leafMm} disabled={blocked} onChange={(ev) => onChange((n) => void (n.leafMm = Number(ev.target.value)))}>
              {widths.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          {linesControl}
        </div>
        <p className="ch-note">Rows are 1 cm tall and leaves 5.5 mm apart, as in the papers.</p>
      </section>
    </>
  );
}
