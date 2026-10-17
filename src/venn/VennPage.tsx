import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { vennGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { vennEditorLink, parseVennLink } from "./links";
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
} from "../site/EditorDownloadMenu";
import { ResourceSize } from "../site/ResourceSize";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { useEffect, useRef, useState } from "react";
import {
  create,
  validate,
  canonical,
  parseFile,
  regionName,
  changeSets,
  hasThirdData,
  activeMasks,
  arrangement,
  changeArrangement,
  hasRegionData,
  upgrade,
  forView,
  relationship,
  type Arrangement,
  expressionMasks,
  warnings,
  layout,
  membership,
  renderSvg,
  kinds,
  visibility,
  type Envelope,
  type Region,
} from "../../packages/venn-core/src";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { printPng, downloadImage, copyWord, downloadEditable } from "./export";
import { VennFloatingEditor } from "./VennFloatingEditor";
import "./venn.css";

const STORAGE = copyStorageKey("maths-booklet-tools:venn:v1");
const arrangementNames: Record<Arrangement, string> = {
  overlap: "Overlap",
  separate: "Separate",
  "b-inside-a": "Nested",
  "a-inside-b": "Nested",
};
const layoutChoices = ["overlap", "separate", "b-inside-a"] as const;
function ArrangementIcon({ value }: { value: Arrangement }) {
  const nested = value.endsWith("inside-a") || value.endsWith("inside-b");
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">
      {nested ? (
        <>
          <circle cx="32" cy="20" r="17" />
          <circle cx="39" cy="20" r="8" />
          <text x="23" y="23">
            {value === "b-inside-a" ? "A" : "B"}
          </text>
          <text x="39" y="23">
            {value === "b-inside-a" ? "B" : "A"}
          </text>
        </>
      ) : (
        <>
          <circle
            cx={value === "separate" ? 17 : 25}
            cy="20"
            r={value === "separate" ? 13 : 16}
          />
          <circle
            cx={value === "separate" ? 47 : 39}
            cy="20"
            r={value === "separate" ? 13 : 16}
          />
        </>
      )}
    </svg>
  );
}
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return {
          e: create(),
          recovery: raw,
          message:
            "Saved Venn data needs recovery. Download the original before starting afresh.",
        };
      }
    }
  } catch {
    return {
      e: create(),
      recovery: null,
      message:
        "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
  return { e: create(), recovery: null, message: "" };
}
type Draft = {
  type: "region" | "label" | "definition" | "expression";
  index: number;
  text: string;
  kind: Region["kind"];
  visibility: Region["visibility"];
  anchor: string;
  title: string;
};
export default function VennPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    [history, setHistory] = useState<{
      past: Envelope[];
      present: Envelope;
      future: Envelope[];
    }>({ past: [], present: startup.e, future: [] });
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device");
  const [draft, setDraft] = useState<Draft | null>(null),
    [draftError, setDraftError] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [tab, setTab] = useState("Diagram"),
    [mode, setMode] = useState("edit"),
    [shade, setShade] = useState<Region["shade"]>("grey"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      e: Envelope;
      title: string;
      explanation: string;
    } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || draft !== null || pending !== null;
  const fitted = useResourceFit(
    (g.width * 96) / 25.4,
    (g.height * 96) / 25.4,
    zoom,
  );
  const issue = g.issues.join(" "),
    note = warnings(e);
  const nested = d.sets === 2 && arrangement(e).includes("inside");
  function labelName(index: number) {
    if (index === 0) return "universe";
    if (nested)
      return index === (arrangement(e) === "a-inside-b" ? 2 : 1)
        ? "outer set"
        : "inner set";
    return "set " + "ABC"[index - 1];
  }
  const panelName = (index: number) => {
    const name = labelName(index);
    return name[0].toUpperCase() + name.slice(1);
  };
  function commit(next: Envelope) {
    if (recovery !== null) return;
    const valid = validate(next);
    setHistory((h) =>
      canonical(h.present) === canonical(valid)
        ? h
        : {
            past: [...h.past, h.present].slice(-60),
            present: valid,
            future: [],
          },
    );
    setMessage("");
  }
  function patch(update: (n: Envelope["document"]) => void) {
    if (blocked) return;
    const n = structuredClone(e);
    update(n.document);
    commit(n);
  }
  function undo() {
    if (blocked) return;
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
    setSelected(null);
  }
  function redo() {
    if (blocked) return;
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
    setSelected(null);
  }
  function replacement(
    next: Envelope,
    title: string,
    explanation = "This replaces the current diagram. You can undo the replacement.",
  ) {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  function selectCount(sets: 1 | 2 | 3) {
    if (blocked || sets === d.sets) return;
    const n = changeSets(e, sets);
    if ((sets === 1 || d.sets === 1) && d.regions.some(hasRegionData))
      replacement(
        n,
        "Start a blank layout?",
        "Changing to or from one set changes the meaning of the regions. This clears all region contents, hidden answers, answer lines and shading; labels, definitions and print settings are retained. No values are combined. You can undo it.",
      );
    else if (d.sets === 3 && sets === 2 && hasThirdData(e))
      replacement(
        n,
        "Remove the third set?",
        "This removes all four regions inside the third set, including hidden answers and shading. Values outside the third set are retained. You can undo it.",
      );
    else {
      commit(n);
      setSelected(null);
    }
  }
  function selectArrangement(value: Arrangement) {
    if (blocked || value === arrangement(e)) return;
    const n = changeArrangement(e, value);
    const removed = activeMasks(e).filter(
      (i) => !activeMasks(n).includes(i) && hasRegionData(d.regions[i]),
    );
    if (removed.length)
      replacement(
        n,
        "Discard incompatible regions?",
        `The ${arrangementNames[value]} layout removes: ${removed.map((i) => regionName(i, e)).join("; ")}. Their contents, hidden answers, answer lines and shading will be cleared. Other regions are retained. No values are moved or combined. You can undo it.`,
      );
    else {
      commit(n);
      setSelected(null);
    }
  }
  function closeDraft() {
    const anchor = draft?.anchor;
    setDraft(null);
    setSelected(null);
    setDraftError("");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-vn-anchor="${anchor}"]`)
        ?.focus({ preventScroll: true }),
    );
  }
  function open(type: Draft["type"], index: number, anchor: string) {
    if (blocked) return;
    const r = d.regions[index];
    setDraftError("");
    setDraft({
      type,
      index,
      anchor,
      title:
        type === "region"
          ? regionName(index, e)
          : type === "label"
            ? `Edit ${labelName(index)} label`
            : type === "definition"
              ? `Edit ${labelName(index)} definition`
              : "Shade a set expression",
      text:
        type === "region"
          ? r.text
          : type === "label"
            ? d.labels[index].text
            : type === "definition"
              ? d.definitions[index]
              : d.sets === 1
                ? "A'"
                : "A ∩ B",
      kind:
        type === "region" ? (r.kind === "empty" ? "members" : r.kind) : "text",
      visibility:
        type === "region"
          ? r.visibility
          : type === "label"
            ? d.labels[index].visibility
            : "show",
    });
    if (type === "region") {
      setSelected(index);
      setTab("Contents");
    }
  }
  function applyDraft() {
    if (!draft) return;
    try {
      const n = structuredClone(e);
      if (draft.type === "region")
        n.document.regions[draft.index] = {
          ...d.regions[draft.index],
          kind: draft.kind,
          text: draft.text,
          visibility: draft.visibility,
        };
      if (draft.type === "label")
        n.document.labels[draft.index] = {
          text: draft.text,
          visibility: draft.visibility,
        };
      if (draft.type === "definition")
        n.document.definitions[draft.index] = draft.text;
      if (draft.type === "expression") {
        const masks = expressionMasks(draft.text, d.sets, activeMasks(e));
        n.document.regions.forEach((r, i) => {
          r.shade = masks.includes(i) ? shade : "none";
        });
      }
      commit(n);
      closeDraft();
      if (
        draft.type === "expression" &&
        expressionMasks(draft.text, d.sets, activeMasks(e)).length === 0
      )
        setMessage(
          "This expression has no region in this layout. All shading has been cleared.",
        );
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
    }
  }
  function chooseRegion(mask: number, anchor: string) {
    if (blocked) return;
    setSelected(mask);
    if (mode === "shade")
      patch((n) => {
        n.regions[mask].shade =
          n.regions[mask].shade === shade ? "none" : shade;
      });
    else open("region", mask, anchor);
  }
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(STORAGE),
        text = canonical(history.present);
      if (
        expected.current !== null &&
        raw !== expected.current &&
        raw !== text
      ) {
        setRecovery(raw ?? "");
        setProtectedCopy(false);
        setMessage(
          "A newer draft exists in another tab. Its saved data is protected.",
        );
        return;
      }
      localStorage.setItem(STORAGE, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Save unavailable — download editable file");
    }
  }, [history.present, recovery]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE && event.newValue !== expected.current) {
        setRecovery(event.newValue ?? "");
        setProtectedCopy(false);
        setMessage(
          "Saved Venn data changed in another tab. Download its data before replacing it.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "Escape" && draft) {
        event.preventDefault();
        closeDraft();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable]")
        )
      ) {
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function run(
    action: () => Promise<void>,
    allowOverflow = false,
    success = "Image copied. Paste with Ctrl+V.",
  ) {
    if (blocked || (!allowOverflow && issue)) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  const linkPending = useRef(false);
  const linkSeen = useRef("");
  useEffect(() => {
    if (!active) return;
    const inspect = () => {
      if (
        !location.hash.startsWith("#venn=") ||
        linkSeen.current === location.href ||
        blocked
      )
        return;
      linkSeen.current = location.href;
      try {
        const incoming = parseVennLink(location.href);
        linkPending.current = true;
        replacement(incoming, "Open the linked Venn diagram?");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  function consumeVennLink() {
    if (linkPending.current && location.hash.startsWith("#venn="))
      window.history.replaceState(
        null,
        "",
        location.pathname + location.search,
      );
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 40000) throw Error("This editable file is too large.");
      replacement(parseFile(await upload.text()), "Open this Venn diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <div className="app-shell booklet-editor vn-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Venn diagrams"
          description="Build blank, populated and shaded diagrams for your teaching resources."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replacement(create(), "Reset the Venn diagram?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(
                  () => copyWord(displayed),
                  false,
                  "Copied for Word at " +
                    formatResourceSize(g.width / 10, g.height / 10) +
                    ". Paste with Ctrl+V.",
                )
              }
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(displayed)))
              }
              menuId="venn-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              id="venn-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={[
                {
                  label: "Download SVG",
                  action: () => downloadImage(displayed, "svg"),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                {
                  label: "Download PNG (600 ppi)",
                  action: () => downloadImage(displayed, "png"),
                  disabled: blocked || !!issue,
                  success: "PNG download started.",
                },
                {
                  label: "Save editable file",
                  action: () => downloadEditable(e),
                  disabled: blocked,
                  success: "Editable file download started.",
                  separator: true,
                },
                {
                  label: "Open editable file",
                  action: () => file.current?.click(),
                  disabled: blocked,
                  success: "",
                  picker: true,
                },
                {
                  label: "Copy editable link",
                  action: () =>
                    navigator.clipboard.writeText(
                      vennEditorLink(e, location.href),
                    ),
                  disabled: blocked,
                  success: "Editable link copied.",
                  description: LINK_DESCRIPTION,
                },
              ]}
            />
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(ev) => {
                const upload = ev.target.files?.[0];
                ev.target.value = "";
                if (upload) void importFile(upload);
              }}
            />
            <div className="vn-preview-bar">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <label className="vn-answer-toggle">
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={view === "answer"}
                  onChange={(ev) =>
                    setView(ev.target.checked ? "answer" : "pupil")
                  }
                />
                Show saved answers
              </label>
              <ResourceSize width={g.width / 10} height={g.height / 10} />
            </div>
            <div
              className="vn-scroll"
              ref={fitted.ref}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && !draft) setSelected(null);
              }}
            >
              <div
                className="vn-resource"
                data-testid="venn-resource"
                style={{
                  width: ((g.width * 96) / 25.4) * fitted.scale,
                  height: ((g.height * 96) / 25.4) * fitted.scale,
                }}
                onClick={(ev) => {
                  if (blocked || (ev.target as HTMLElement).closest("button"))
                    return;
                  const r = ev.currentTarget.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * g.width) / r.width,
                    y = ((ev.clientY - r.top) * g.height) / r.height;
                  if (
                    x > g.box.x &&
                    x < g.box.x + g.box.width &&
                    y > g.box.y &&
                    y < g.box.y + g.box.height
                  ) {
                    const mask = membership(g, x, y);
                    chooseRegion(mask, `region-${mask}`);
                  } else setSelected(null);
                }}
              >
                <div
                  className="vn-art"
                  dangerouslySetInnerHTML={{ __html: renderSvg(displayed) }}
                />
                {activeMasks(e).map((mask) => {
                  const p = g.anchors[mask];
                  return (
                    <button
                      key={`r${mask}`}
                      className={`vn-hit ${selected === mask ? "vn-selected" : ""}`}
                      data-vn-anchor={`region-${mask}`}
                      data-region-hit={mask}
                      aria-label={`${mode === "shade" ? "Shade" : "Edit"} region: ${regionName(mask, e)}`}
                      title={regionName(mask, e)}
                      disabled={busy || recovery !== null}
                      style={{
                        left: `${(p.x / g.width) * 100}%`,
                        top: `${(p.y / g.height) * 100}%`,
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        chooseRegion(mask, `region-${mask}`);
                      }}
                    />
                  );
                })}
                {g.labelPoints.map((p, i) => (
                  <button
                    key={`l${i}`}
                    className="vn-hit vn-label-hit"
                    data-vn-anchor={`label-${i}`}
                    aria-label={`Edit ${labelName(i)} label`}
                    disabled={busy || recovery !== null}
                    style={{
                      left: `${(p.x / g.width) * 100}%`,
                      top: `${(p.y / g.height) * 100}%`,
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      open("label", i, `label-${i}`);
                    }}
                  />
                ))}
                {d.showDefinitions &&
                  d.definitions
                    .slice(0, d.sets + 1)
                    .map((text, index) => ({ text, index }))
                    .filter((x) => x.text)
                    .map(({ index }, row) => (
                      <button
                        key={`d${index}`}
                        className="vn-hit vn-definition-hit"
                        data-vn-anchor={`direct-definition-${index}`}
                        aria-label={`Edit printed ${labelName(index)} definition`}
                        style={{
                          left: "50%",
                          top: `${((4 + g.font * 0.65 + row * (g.font + 2)) / g.height) * 100}%`,
                          width: "94%",
                        }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          open(
                            "definition",
                            index,
                            `direct-definition-${index}`,
                          );
                        }}
                      />
                    ))}
              </div>
            </div>
            {(message || draft || issue || note.length > 0) && (
              <div className="vn-status" aria-live="polite">
                {message && (
                  <p className="resource-feedback" role="status">
                    {message}
                  </p>
                )}
                {draft && (
                  <p>
                    Apply or cancel the open editor before another edit or
                    export.
                  </p>
                )}
                {issue && (
                  <p className="vn-error" role="alert">
                    {issue}
                  </p>
                )}
                {note.map((w) => (
                  <p key={w}>Teacher note: {w}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside className="inspector-stack" aria-label="Venn diagram settings">
            <ExampleGallery
              examples={vennGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) =>
                replacement(resource, `Open ${title}?`)
              }
              onWorked={(resource) => commit(resource)}
            />
            <section className="panel-card vn-layout-tools">
              <h2>Diagram tools</h2>
              <div className="vn-structure">
                <div
                  className="vn-mode-switch"
                  role="group"
                  aria-label="Diagram mode"
                >
                  <button
                    disabled={blocked}
                    aria-pressed={mode === "edit"}
                    onClick={() => {
                      setMode("edit");
                      setSelected(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={blocked}
                    aria-pressed={mode === "shade"}
                    onClick={() => {
                      setMode("shade");
                      setSelected(null);
                    }}
                  >
                    Shade
                  </button>
                </div>
                <span>
                  {d.sets} {d.sets === 1 ? "set" : "sets"} ·{" "}
                  {mode === "shade"
                    ? "Click a region to shade or clear it"
                    : "Click a region or label to edit"}
                </span>
                <label>
                  Number of sets
                  <select
                    aria-label="Number of sets"
                    disabled={blocked}
                    value={d.sets}
                    onChange={(ev) =>
                      selectCount(Number(ev.target.value) as 1 | 2 | 3)
                    }
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {d.sets === 2 && (
                <div
                  className="vn-arrangements"
                  role="group"
                  aria-label="Set arrangement"
                >
                  {layoutChoices.map((value) => (
                    <button
                      key={value}
                      aria-pressed={
                        value === "b-inside-a"
                          ? nested
                          : arrangement(e) === value
                      }
                      disabled={blocked}
                      onClick={() =>
                        selectArrangement(
                          value === "b-inside-a" &&
                            arrangement(e) === "a-inside-b"
                            ? "a-inside-b"
                            : value,
                        )
                      }
                    >
                      <ArrangementIcon
                        value={
                          value === "b-inside-a" && nested
                            ? arrangement(e)
                            : value
                        }
                      />
                      <span>{arrangementNames[value]}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="vn-view-note">
                {view === "pupil"
                  ? "Pupil view · exports keep your pupil blanks and hidden answers."
                  : "Answer view · exports reveal saved answers only. Editable files keep the pupil settings."}
              </p>
            </section>
            <section className="panel-card vn-inspector">
              {mode === "edit" && (
                <div
                  className="vn-tabs"
                  role="tablist"
                  aria-label="Venn settings"
                >
                  {["Diagram", "Contents"].map((t) => (
                    <button
                      key={t}
                      role="tab"
                      id={`vn-tab-${t}`}
                      aria-selected={tab === t}
                      tabIndex={tab === t ? 0 : -1}
                      onKeyDown={(ev) => {
                        const tabs = ["Diagram", "Contents"];
                        let index = tabs.indexOf(t);
                        if (ev.key === "ArrowRight") index = (index + 1) % 2;
                        else if (ev.key === "ArrowLeft")
                          index = (index + 1) % 2;
                        else if (ev.key === "Home") index = 0;
                        else if (ev.key === "End") index = 1;
                        else return;
                        ev.preventDefault();
                        setTab(tabs[index]);
                        document
                          .getElementById(`vn-tab-${tabs[index]}`)
                          ?.focus();
                      }}
                      aria-controls={`vn-panel-${t}`}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <div
                role={mode === "edit" ? "tabpanel" : "region"}
                id={mode === "edit" ? `vn-panel-${tab}` : "vn-panel-shading"}
                aria-labelledby={
                  mode === "edit" ? `vn-tab-${tab}` : "vn-shading-heading"
                }
              >
                {mode === "edit" && tab === "Diagram" && (
                  <>
                    <h2>Diagram</h2>
                    <label>
                      Outline
                      <select
                        aria-label="Outline"
                        disabled={blocked || d.sets === 3}
                        value={d.shape}
                        onChange={(ev) =>
                          patch((n) => {
                            n.shape = ev.target.value as "circles" | "ovals";
                          })
                        }
                      >
                        <option value="circles">Circles</option>
                        <option value="ovals">Wider ovals</option>
                      </select>
                    </label>
                    {relationship(e) && (
                      <label>
                        Relationship caption
                        <select
                          aria-label="Relationship caption"
                          disabled={blocked}
                          value={
                            e.schemaVersion === 2 ? e.document.caption : "off"
                          }
                          onChange={(ev) => {
                            const n = upgrade(e);
                            n.document.caption = ev.target.value as
                              | "off"
                              | "relationship"
                              | "line";
                            commit(n);
                          }}
                        >
                          <option value="off">No caption</option>
                          <option value="relationship">
                            {relationship(e)}
                          </option>
                          <option value="line">Pupil answer line</option>
                        </select>
                      </label>
                    )}
                    <details>
                      <summary>Labels and definitions</summary>
                      <p className="vn-note">
                        Click a label on the diagram or choose it here.
                      </p>
                      {d.labels.slice(0, d.sets + 1).map((l, i) => (
                        <div className="vn-label-row" key={i}>
                          <button
                            data-vn-anchor={"panel-label-" + i}
                            disabled={blocked}
                            onClick={() => open("label", i, "panel-label-" + i)}
                          >
                            {panelName(i)}: {l.text || "(empty)"}
                            <small>
                              {l.visibility === "hidden"
                                ? "Hidden"
                                : l.visibility === "line"
                                  ? "Answer line"
                                  : "Edit label"}
                            </small>
                          </button>
                        </div>
                      ))}
                      <label className="vn-check">
                        <input
                          type="checkbox"
                          checked={d.showDefinitions}
                          disabled={blocked}
                          onChange={(ev) =>
                            patch((n) => {
                              n.showDefinitions = ev.target.checked;
                            })
                          }
                        />
                        Show definitions above diagram
                      </label>
                      {d.definitions.slice(0, d.sets + 1).map((text, i) => (
                        <button
                          className="vn-definition"
                          key={i}
                          data-vn-anchor={"definition-" + i}
                          disabled={blocked}
                          onClick={() =>
                            open("definition", i, "definition-" + i)
                          }
                        >
                          {panelName(i)} definition: {text || "Add text"}
                        </button>
                      ))}
                      <p className="vn-note">
                        Definitions describe your sets; they do not fill or
                        calculate regions. Geometry is schematic.
                      </p>
                    </details>
                    <details>
                      <summary>Print size</summary>
                      <label>
                        Print width
                        <select
                          aria-label="Print width"
                          disabled={blocked}
                          value={d.widthCm}
                          onChange={(ev) =>
                            patch((n) => {
                              n.widthCm = Number(ev.target.value);
                            })
                          }
                        >
                          {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((v) => (
                            <option key={v} value={v}>
                              {v} cm
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Text size
                        <select
                          aria-label="Text size"
                          value={d.fontPt}
                          disabled={blocked}
                          onChange={(ev) =>
                            patch((n) => {
                              n.fontPt = Number(ev.target.value);
                            })
                          }
                        >
                          {[9, 10, 11, 12, 13, 14].map((v) => (
                            <option key={v} value={v}>
                              {v} pt
                            </option>
                          ))}
                        </select>
                      </label>
                    </details>
                  </>
                )}
                {mode === "edit" && tab === "Contents" && (
                  <>
                    <h2>Region contents</h2>
                    <p className="vn-note">
                      Click the diagram or choose a region. Lists, frequencies,
                      fractions, algebra and pupil blanks stay editable.
                    </p>
                    <div className="vn-regions">
                      {activeMasks(e).map((mask) => (
                        <button
                          key={mask}
                          data-vn-anchor={`panel-region-${mask}`}
                          disabled={blocked}
                          onClick={() => {
                            setMode("edit");
                            open("region", mask, `panel-region-${mask}`);
                          }}
                        >
                          <span>{regionName(mask, e)}</span>
                          <small>
                            {d.regions[mask].visibility === "hidden"
                              ? "Hidden saved content"
                              : d.regions[mask].visibility === "line"
                                ? "Answer line"
                                : d.regions[mask].text ||
                                  (d.regions[mask].kind === "members"
                                    ? "Empty member list"
                                    : "Empty space")}
                          </small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {mode === "shade" && (
                  <>
                    <h2 id="vn-shading-heading">Region shading</h2>
                    <label>
                      Shading style
                      <select
                        aria-label="Shading style"
                        disabled={blocked}
                        value={shade}
                        onChange={(ev) =>
                          setShade(ev.target.value as Region["shade"])
                        }
                      >
                        <option value="grey">Neutral grey</option>
                        <option value="hatch">Monochrome hatching</option>
                      </select>
                    </label>
                    <button
                      disabled={blocked}
                      data-vn-anchor="expression"
                      onClick={() => open("expression", 0, "expression")}
                    >
                      Shade a set expression
                    </button>
                    <p className="vn-note">
                      Use stable set IDs:{" "}
                      {d.labels
                        .slice(1, d.sets + 1)
                        .map((l, i) => `${"ABC"[i]} = ${l.text || "unnamed"}`)
                        .join("; ")}
                      . ∩ means both; ∪ means either; ' means complement.
                    </p>
                    <button
                      disabled={blocked}
                      onClick={() =>
                        patch((n) =>
                          n.regions.forEach((r) => {
                            r.shade = "none";
                          }),
                        )
                      }
                    >
                      Clear all shading
                    </button>
                    <div className="vn-regions">
                      {activeMasks(e).map((mask) => (
                        <button
                          key={mask}
                          disabled={blocked}
                          aria-pressed={d.regions[mask].shade !== "none"}
                          onClick={() =>
                            patch((n) => {
                              n.regions[mask].shade =
                                n.regions[mask].shade === shade
                                  ? "none"
                                  : shade;
                            })
                          }
                        >
                          {regionName(mask, e)}
                          <small>{d.regions[mask].shade}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="panel-card vn-inspector">
              <details>
                <summary>Editing and printing help</summary>
                <p className="vn-note">
                  Use commas, semicolons or new lines between members. Use 1/2
                  for a stacked fraction. Blank, hidden content, an answer line
                  and zero are different states. No automatic solving.
                </p>
                <p className="vn-note">
                  Enter applies; Escape cancels. Save an editable file to keep a
                  portable copy. Copy for Word carries the physical size shown
                  above the diagram. Download PNG (600 ppi) if your browser
                  blocks copying.
                </p>
              </details>
            </section>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card vn-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(
                  new Blob([recovery], { type: "application/json" }),
                  "venn-recovery.json",
                );
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>
              Save current diagram
            </button>
            <button
              disabled={!protectedCopy}
              onClick={() => {
                try {
                  const raw = localStorage.getItem(STORAGE);
                  if (raw !== recovery) {
                    setRecovery(raw ?? "");
                    setProtectedCopy(false);
                    setMessage(
                      "Saved data changed again. Download this latest copy first.",
                    );
                    return;
                  }
                  expected.current = raw;
                  setRecovery(null);
                  setMessage("");
                } catch {
                  setMessage(
                    "Storage is unavailable. Keep your downloaded files.",
                  );
                }
              }}
            >
              Keep this diagram and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this diagram"
            onCancel={() => {
              consumeVennLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null || draft !== null) return;
              consumeVennLink();
              commit(pending.e);
              setPending(null);
              setSelected(null);
              setView("pupil");
            }}
          >
            <p>{pending.explanation}</p>
            <div
              className="ratio-import-preview"
              dangerouslySetInnerHTML={{
                __html: renderSvg(forView(pending.e, "pupil")),
              }}
            />
          </RatioDialog>
        )}
        {draft && (
          <VennFloatingEditor
            active={active && !pending && recovery === null}
            anchor={draft.anchor}
            title={draft.title}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                applyDraft();
              }}
            >
              {draft.type === "region" && (
                <label>
                  Content type
                  <select
                    aria-label="Content type"
                    value={draft.kind}
                    onChange={(ev) => {
                      setDraft({
                        ...draft,
                        kind: ev.target.value as Region["kind"],
                      });
                      setDraftError("");
                    }}
                  >
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {
                          {
                            empty: "Empty space",
                            members: "Member list",
                            frequency: "Frequency",
                            number: "Number or fraction",
                            algebra: "Algebraic label",
                            text: "Ordinary text",
                          }[k]
                        }
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {draft.type === "expression"
                  ? "Set expression"
                  : draft.type === "region"
                    ? "Region content"
                    : draft.type === "definition"
                      ? "Definition text"
                      : "Label text"}
                {draft.type === "region" && draft.kind === "members" ? (
                  <textarea
                    aria-label="Region content"
                    rows={3}
                    value={draft.text}
                    aria-invalid={!!draftError}
                    onChange={(ev) => {
                      setDraft({ ...draft, text: ev.target.value });
                      setDraftError("");
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" && !ev.shiftKey) {
                        ev.preventDefault();
                        applyDraft();
                      }
                    }}
                  />
                ) : (
                  <input
                    aria-label={
                      draft.type === "expression"
                        ? "Set expression"
                        : draft.type === "region"
                          ? "Region content"
                          : draft.type === "definition"
                            ? "Definition text"
                            : "Label text"
                    }
                    value={draft.text}
                    aria-invalid={!!draftError}
                    onChange={(ev) => {
                      setDraft({ ...draft, text: ev.target.value });
                      setDraftError("");
                    }}
                  />
                )}
              </label>
              {(draft.type === "region" || draft.type === "label") && (
                <label>
                  Pupil display
                  <select
                    aria-label="Pupil display"
                    value={draft.visibility}
                    onChange={(ev) =>
                      setDraft({
                        ...draft,
                        visibility: ev.target.value as Region["visibility"],
                      })
                    }
                  >
                    {visibility.map((v) => (
                      <option key={v} value={v}>
                        {v === "show"
                          ? "Show content"
                          : v === "hidden"
                            ? "Hide (retain content)"
                            : "Pupil answer line"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {draft.type === "region" && (
                <p className="vn-note">
                  For members, use commas or new lines (Shift+Enter). An empty
                  member list prints no zero. Empty space retains any text for
                  later.
                </p>
              )}
              {draft.type === "expression" && (
                <>
                  <div className="vn-expression-buttons">
                    {[
                      ..."ABC".slice(0, d.sets),
                      " ∪ ",
                      " ∩ ",
                      "'",
                      "(",
                      ")",
                    ].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() =>
                          setDraft({ ...draft, text: draft.text + s })
                        }
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, text: "" })}
                    >
                      Clear
                    </button>
                  </div>
                  <p className="vn-note">
                    For example {d.sets === 1 ? "A'" : "A ∩ B or (A ∪ B)'"}.
                    Applying replaces the current shading.
                  </p>
                </>
              )}
              {draftError && (
                <p className="vn-error" role="alert">
                  {draftError}
                </p>
              )}
              <div className="vn-actions">
                <button type="submit">Apply</button>
                <button type="button" onClick={closeDraft}>
                  Cancel
                </button>
              </div>
            </form>
          </VennFloatingEditor>
        )}
      </main>
    </div>
  );
}
