import { useEffect, useRef, useState } from "react";
import * as c from "../../packages/bar-model-core/src";
import {
  apply,
  editorLink,
  parseLink,
  type Operation,
} from "../../packages/bar-model-core/src/interchange";
import { EditorToolbar } from "../site/EditorToolbar";
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
} from "../site/EditorDownloadMenu";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSize } from "../site/ResourceSize";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { PreviewControls } from "../site/PreviewControls";
import { useResourceFit } from "../site/useResourceFit";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { ExampleGallery } from "../examples/ExampleGallery";
import { barGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, printPng, downloadImage, downloadEditable } from "./export";
import "./bar-model.css";
import * as versioned from "../../packages/bar-model-core/src/versioned";
import * as improved from "../../packages/bar-model-core/src/v2";

const STORAGE = copyStorageKey("maths-booklet-tools:bar-model:v1");
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function initial() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE);
    return {
      e: raw ? c.parseFile(raw) : c.fresh(),
      raw,
      recovery: null as string | null,
      message: "",
    };
  } catch {
    return {
      e: c.fresh(),
      raw,
      recovery: raw,
      message: raw
        ? "Saved data needs recovery. The original data is protected."
        : "Device storage unavailable. Save an editable file to keep your work.",
    };
  }
}
type Target = { barId?: string; partId?: string; spanId?: string };
type Draft =
  | { type: "label"; target: Target; label: c.Label }
  | {
      type: "part";
      barId: string;
      partId: string;
      weight: string;
      shade: boolean;
    }
  | { type: "span"; span: c.Span; isNew: boolean }
  | { type: "alignment"; barId: string; offset: string }
  | {
      type: "print";
      values: Record<keyof c.Envelope["document"]["presentation"], string>;
    };
export interface ManagedLegacy {
  present: c.Envelope;
  onCommit: (e: c.Envelope) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
export default function BarModelPage({
  active = true,
  onUpgrade,
  onOpenModern,
  managed,
  onNewModel,
}: {
  active?: boolean;
  onUpgrade?: (h: {
    past: c.Envelope[];
    present: c.Envelope;
    future: c.Envelope[];
  }) => void;
  onOpenModern?: (e: versioned.Envelope) => void;
  managed?: ManagedLegacy;
  onNewModel?: () => void;
}) {
  const [startup] = useState(() =>
    managed
      ? { e: managed.present, raw: null, recovery: null, message: "" }
      : initial(),
  );
  const [history, setHistory] = useState({
    past: [] as c.Envelope[],
    present: startup.e,
    future: [] as c.Envelope[],
  });
  const e = managed?.present ?? history.present,
    d = e.document,
    g = c.layout(e);
  const [draft, setDraft] = useState<Draft | null>(null),
    [inputError, setInputError] = useState("");
  const [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device");
  const [pending, setPending] = useState<{
      e: c.Envelope;
      title: string;
    } | null>(null),
    [recovery, setRecovery] = useState(startup.recovery),
    [conflict, setConflict] = useState(false);
  const [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(0),
    [selected, setSelected] = useState(d.bars[0].id);
  const [removal, setRemoval] = useState<Operation | null>(null);
  const expected = useRef(startup.raw),
    seenLink = useRef(""),
    file = useRef<HTMLInputElement>(null),
    editor = useRef<HTMLDivElement>(null);
  const blocked =
    !!draft || !!pending || !!removal || recovery !== null || conflict || busy;
  const guard = useRef(blocked);
  guard.current = blocked;
  const fit = useResourceFit(
      (g.width * 96) / 25.4,
      (g.height * 96) / 25.4,
      zoom,
      120,
      100,
    ),
    px = (fit.scale * 96) / 25.4;
  const issue = c.exportIssue(e),
    currentBar = d.bars.find((b) => b.id === selected) ?? d.bars[0];
  const drafting = draft !== null;
  useEffect(() => {
    if (drafting && active) {
      const panel = document.querySelector<HTMLElement>(".bm-draft");
      panel?.scrollIntoView({ block: "nearest" });
      panel?.querySelector<HTMLInputElement>("input,select")?.focus();
    }
  }, [drafting, active]);
  function commit(n: c.Envelope) {
    const valid = c.validate(n);
    if (managed) {
      managed.onCommit(valid);
      return;
    }
    setHistory((h) =>
      c.canonical(h.present) === c.canonical(valid)
        ? h
        : {
            past: [...h.past, h.present].slice(-60),
            present: valid,
            future: [],
          },
    );
  }
  function operation(op: Operation) {
    if (guard.current) return;
    try {
      commit(apply(e, [op]));
      setMessage("");
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function undo() {
    if (guard.current) return;
    if (managed) {
      managed.onUndo();
      return;
    }
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  }
  function redo() {
    if (guard.current) return;
    if (managed) {
      managed.onRedo();
      return;
    }
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  }
  function start(n: Draft) {
    if (guard.current) return;
    setInputError("");
    setDraft(n);
  }
  function editLabel(target: Target, label: c.Label) {
    start({ type: "label", target, label: structuredClone(label) });
  }
  function cancelDraft() {
    setDraft(null);
    setInputError("");
    editor.current?.focus();
  }
  function applyDraft() {
    if (!draft || recovery !== null || conflict) return;
    try {
      let op: Operation;
      if (draft.type === "label")
        op = { op: "set_label", target: draft.target, label: draft.label };
      else if (draft.type === "part")
        op = {
          op: "set_part",
          barId: draft.barId,
          partId: draft.partId,
          weight: draft.weight,
          shade: draft.shade,
        };
      else if (draft.type === "span")
        op = { op: draft.isNew ? "add_span" : "set_span", span: draft.span };
      else if (draft.type === "alignment")
        op = { op: "set_alignment", barId: draft.barId, offset: draft.offset };
      else
        op = {
          op: "set_print",
          presentation: Object.fromEntries(
            Object.entries(draft.values).map(([k, v]) => [k, Number(v)]),
          ),
        };
      commit(apply(e, [op]));
      cancelDraft();
    } catch (err) {
      setInputError(errorText(err));
    }
  }
  useEffect(() => {
    if (managed) return;
    if (recovery !== null || conflict) return;
    try {
      const now = localStorage.getItem(STORAGE);
      if (now !== expected.current) {
        setConflict(true);
        setSaveState("Newer saved work is protected");
        return;
      }
      const text = c.canonical(e);
      if (text !== now) localStorage.setItem(STORAGE, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Not saved on device — save an editable file");
    }
  }, [e, recovery, conflict, managed]);
  useEffect(() => {
    if (managed) return;
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE && event.newValue !== expected.current) {
        setConflict(true);
        setSaveState("Newer saved work is protected");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [managed]);
  useEffect(() => {
    if (!active) return;
    const keys = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  useEffect(() => {
    if (!active || managed) return;
    const read = () => {
      if (
        guard.current ||
        !location.hash.startsWith("#bar-model=") ||
        seenLink.current === location.href
      )
        return;
      seenLink.current = location.href;
      try {
        const n = parseLink(location.href);
        window.history.replaceState(
          {},
          "",
          location.pathname + location.search,
        );
        window.dispatchEvent(new Event("maths-tools:route"));
        setPending({ e: n, title: "Open linked bar model?" });
      } catch (err) {
        setMessage(errorText(err));
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [active, blocked, managed]);
  async function output(fn: () => void | Promise<void>, success: string) {
    if (guard.current || issue) return;
    setBusy(true);
    try {
      await fn();
      setMessage(success);
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  function newId(prefix: string) {
    const used = new Set([
      ...d.bars.flatMap((b) => [b.id, ...b.parts.map((p) => p.id)]),
      ...d.spans.map((s) => s.id),
    ]);
    let i = 1;
    while (used.has(prefix + i)) i++;
    return prefix + i;
  }
  function addBar() {
    operation({
      op: "add_bar",
      bar: {
        id: newId("b"),
        name: c.label("Quantity"),
        offset: "0",
        parts: [
          { id: newId("p"), weight: "1", label: c.label(), shade: false },
        ],
      },
    });
  }
  function remove(op: Operation) {
    if (guard.current) return;
    try {
      commit(apply(e, [op]));
    } catch (err) {
      if (errorText(err).includes("discardSpans")) setRemoval(op);
      else setMessage(errorText(err));
    }
  }
  function addSpan() {
    const b = currentBar;
    start({
      type: "span",
      isNew: true,
      span: {
        id: newId("s"),
        from: { barId: b.id, partId: b.parts[0].id, edge: "start" },
        to: { barId: b.id, partId: b.parts.at(-1)!.id, edge: "end" },
        side: "above",
        style: "brace",
        label: c.label("", "question"),
      },
    });
  }
  const actions = [
    {
      label: "Download SVG",
      disabled: blocked || !!issue,
      action: () => downloadImage(e, "svg"),
      success: "SVG download started",
    },
    {
      label: "Download PNG (600 ppi)",
      disabled: blocked || !!issue,
      action: () => downloadImage(e, "png"),
      success: "PNG download started",
    },
    {
      label: "Save editable file",
      disabled: blocked,
      action: () => downloadEditable(e),
      success: "Editable file download started",
    },
    {
      label: "Open editable file",
      disabled: blocked,
      action: () => file.current?.click(),
      picker: true,
    },
    {
      label: "Copy editable link",
      disabled: blocked,
      description: LINK_DESCRIPTION,
      action: async () => {
        await navigator.clipboard.writeText(editorLink(e, location.href));
      },
      success: "Editable link copied",
    },
  ];
  const stateSelect = (l: c.Label, change: (l: c.Label) => void) => (
    <>
      <label>
        Saved label
        <input
          aria-label="Saved label"
          value={l.text}
          maxLength={80}
          onChange={(ev) =>
            change({
              ...l,
              text: ev.target.value,
              state:
                l.state === "blank" && l.text === "" && ev.target.value !== ""
                  ? "value"
                  : l.state,
            })
          }
        />
      </label>
      <label>
        Label state
        <select
          aria-label="Label state"
          value={l.state}
          onChange={(ev) =>
            change({ ...l, state: ev.target.value as c.Label["state"] })
          }
        >
          {c.labelSchema.shape.state.options.map((s) => (
            <option key={s} value={s}>
              {
                {
                  value: "Print label",
                  blank: "Leave blank",
                  question: "Question mark",
                  line: "Answer line",
                  hidden: "Hide saved answer",
                }[s]
              }
            </option>
          ))}
        </select>
      </label>
      <p>
        Blank, question-mark, answer-line and hidden settings retain saved text.
        Entering a new label in an empty blank selects Print label; saved hidden
        answers stay hidden.
      </p>
    </>
  );
  return (
    <div className="app-shell booklet-editor bm-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Bar modelling"
          description="Make linked bars for sharing, fractions and comparisons."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        {managed && (
          <p>
            Legacy layout and source are preserved. Ordinary edits keep version
            1.
          </p>
        )}
        <section className="workspace">
          <Panel className="editor-card">
            {onUpgrade && (
              <details>
                <summary>Use improved layout</summary>
                <p>
                  Keep the original labels, saved answers and fixed endpoints.
                  Spacing and source version will change. One Undo restores this
                  version.
                </p>
                <div
                  className="bm-choice-preview"
                  dangerouslySetInnerHTML={{
                    __html: improved.renderSvg(improved.upgrade(e)),
                  }}
                />
                <button disabled={blocked} onClick={() => onUpgrade(history)}>
                  Use improved layout
                </button>
              </details>
            )}
            <EditorToolbar
              canUndo={!blocked && (managed?.canUndo ?? !!history.past.length)}
              canRedo={
                !blocked && (managed?.canRedo ?? !!history.future.length)
              }
              onUndo={undo}
              onRedo={redo}
              onReset={() => {
                if (!guard.current && onNewModel) onNewModel();
                else if (!guard.current)
                  setPending({ e: c.fresh(), title: "Reset bar model?" });
              }}
              resetLabel={onNewModel ? "New model" : undefined}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void output(() => copyWord(e), "Copied for Word")}
              onCopyClipboard={() =>
                void output(async () => {
                  await copyPngToClipboard(() => printPng(e));
                }, "Image copied")
              }
              menuOpen={menu}
              onToggleMenu={() => setMenu((v) => !v)}
              menuId="bar-model-files"
            />
            <EditorDownloadMenu
              id="bar-model-files"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              actions={actions}
              onMessage={setMessage}
              onBusyChange={setBusy}
            />
            <input
              ref={file}
              aria-label="Open bar model file"
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (!f || guard.current) return;
                try {
                  if (f.size > c.LIMITS.requestBytes)
                    throw Error("Editable file exceeds32KiB.");
                  const text = await f.text();
                  if (guard.current) return;
                  setPending({
                    e: (() => {
                      const parsed = versioned.parseFile(text);
                      if (parsed.schemaVersion === 2) {
                        onOpenModern?.(parsed);
                        throw Error("Opened improved model.");
                      }
                      return parsed;
                    })(),
                    title: "Open editable bar model?",
                  });
                } catch (err) {
                  setMessage(errorText(err));
                }
              }}
            />
            <div className="preview-controls">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
            </div>
            <div ref={fit.ref} className="bm-scroll">
              <div
                className="bm-stage"
                style={{
                  width: g.width * px,
                  minHeight: Math.max(10, g.height * px),
                }}
              >
                <div
                  ref={editor}
                  tabIndex={-1}
                  className="bm-resource"
                  style={{ width: g.width * px, height: g.height * px }}
                >
                  <div
                    className="bm-art"
                    dangerouslySetInnerHTML={{ __html: c.renderSvg(e) }}
                  />
                  {g.rows.map((r) => (
                    <div key={r.bar.id}>
                      <button
                        className="bm-hit"
                        aria-label={`Edit name ${r.bar.id}`}
                        disabled={blocked}
                        style={{
                          left: 0,
                          top: r.y * px,
                          width: d.presentation.nameWidthMm * px,
                          height: r.height * px,
                        }}
                        onClick={() =>
                          editLabel({ barId: r.bar.id }, r.bar.name)
                        }
                      />
                      {r.parts.map((p) => (
                        <button
                          key={p.part.id}
                          className="bm-hit"
                          disabled={blocked}
                          aria-label={`Edit label ${p.part.id}`}
                          style={{
                            left: p.x * px,
                            top: r.y * px,
                            width: p.width * px,
                            height: d.presentation.barHeightMm * px,
                          }}
                          onClick={() => {
                            setSelected(r.bar.id);
                            editLabel(
                              { barId: r.bar.id, partId: p.part.id },
                              p.part.label,
                            );
                          }}
                        />
                      ))}
                    </div>
                  ))}
                  {g.spans.map((s) => (
                    <button
                      key={s.span.id}
                      className="bm-hit"
                      disabled={blocked}
                      aria-label={`Edit brace ${s.span.id}`}
                      style={{
                        left: s.x1 * px,
                        width: (s.x2 - s.x1) * px,
                        top: (s.y + (s.span.side === "above" ? -10 : 0)) * px,
                        height: 11 * px,
                      }}
                      onClick={() =>
                        start({
                          type: "span",
                          span: structuredClone(s.span),
                          isNew: false,
                        })
                      }
                    />
                  ))}
                </div>
                <div
                  className="bm-side-controls"
                  style={{
                    top: Math.max(
                      4,
                      Math.min(
                        24 +
                          (g.rows.find((r) => r.bar.id === currentBar.id)!.y +
                            d.presentation.barHeightMm / 2) *
                            px -
                          48,
                        Math.max(10, g.height * px) - 10,
                      ),
                    ),
                  }}
                >
                  <button
                    disabled={blocked || currentBar.parts.length >= 24}
                    onClick={() =>
                      operation({
                        op: "add_part",
                        barId: currentBar.id,
                        part: {
                          id: newId("p"),
                          weight: "1",
                          label: c.label(),
                          shade: false,
                        },
                      })
                    }
                  >
                    + Part
                  </button>
                  <button
                    disabled={blocked || currentBar.parts.length <= 1}
                    onClick={() =>
                      remove({
                        op: "remove_part",
                        barId: currentBar.id,
                        partId: currentBar.parts.at(-1)!.id,
                      })
                    }
                  >
                    − Part
                  </button>
                </div>
                <div className="bm-bottom-controls">
                  <button
                    disabled={blocked || d.bars.length >= 6}
                    onClick={addBar}
                  >
                    + Bar
                  </button>
                  <button
                    disabled={blocked || d.bars.length <= 1}
                    onClick={() =>
                      remove({ op: "remove_bar", barId: currentBar.id })
                    }
                  >
                    − Bar
                  </button>
                </div>
              </div>
            </div>
            {draft && (
              <p className="bm-pending">
                An edit is pending. Apply or Cancel it in settings before
                exporting.
              </p>
            )}
            {issue && <p role="alert">{issue}</p>}
            {message && <p role="status">{message}</p>}
            {(recovery !== null || conflict) && (
              <section className="bm-recovery" aria-label="Recovery">
                <p>
                  Saved work is protected. Download current work before choosing
                  a fresh start or reload.
                </p>
                <button
                  onClick={() =>
                    downloadBlob(
                      new Blob([recovery ?? c.canonical(e)], {
                        type: "application/json",
                      }),
                      "bar-model-recovery.json",
                    )
                  }
                >
                  Download recovery data
                </button>
                <button
                  onClick={() => {
                    try {
                      expected.current = localStorage.getItem(STORAGE);
                      setConflict(false);
                      setRecovery(null);
                      commit(c.fresh());
                    } catch {
                      setMessage(
                        "Storage remains unavailable. Keep an editable file.",
                      );
                    }
                  }}
                >
                  Start fresh deliberately
                </button>
              </section>
            )}
          </Panel>
          <aside
            className="inspector-stack"
            aria-label="Bar modelling settings"
          >
            <ExampleGallery
              examples={barGallery}
              active={active}
              disabled={blocked}
              onUse={(n, title) => {
                if (!guard.current)
                  setPending({ e: n, title: `Open ${title}?` });
              }}
              onWorked={(n) => {
                if (!guard.current) commit(n);
              }}
            />
            <section className="panel-card bm-settings">
              <h2>Bars and labels</h2>
              <label>
                Selected bar
                <select
                  aria-label="Selected bar"
                  disabled={blocked}
                  value={currentBar.id}
                  onChange={(ev) => setSelected(ev.target.value)}
                >
                  {d.bars.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.id}: {b.name.text || "Unnamed"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={blocked}
                onClick={() =>
                  editLabel({ barId: currentBar.id }, currentBar.name)
                }
              >
                Edit quantity name
              </button>
              <button
                disabled={blocked}
                onClick={() =>
                  start({
                    type: "alignment",
                    barId: currentBar.id,
                    offset: currentBar.offset,
                  })
                }
              >
                Edit alignment
              </button>
              <div className="bm-parts">
                {currentBar.parts.map((p, i) => (
                  <div key={p.id}>
                    <span>Part {i + 1}</span>
                    <button
                      disabled={blocked}
                      onClick={() =>
                        editLabel(
                          { barId: currentBar.id, partId: p.id },
                          p.label,
                        )
                      }
                    >
                      Label {p.id}
                    </button>
                    <button
                      disabled={blocked}
                      onClick={() =>
                        start({
                          type: "part",
                          barId: currentBar.id,
                          partId: p.id,
                          weight: p.weight,
                          shade: p.shade,
                        })
                      }
                    >
                      Weight / shade
                    </button>
                    <button
                      disabled={blocked || currentBar.parts.length === 1}
                      aria-label={`Remove ${p.id}`}
                      onClick={() =>
                        remove({
                          op: "remove_part",
                          barId: currentBar.id,
                          partId: p.id,
                        })
                      }
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel-card bm-settings">
              <h2>Braces and spans</h2>
              <button
                disabled={blocked || d.spans.length >= 18}
                onClick={addSpan}
              >
                Add brace
              </button>
              {d.spans.map((s) => (
                <div className="bm-pair" key={s.id}>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        type: "span",
                        isNew: false,
                        span: structuredClone(s),
                      })
                    }
                  >
                    Edit {s.id}
                  </button>
                  <button
                    aria-label={`Remove brace ${s.id}`}
                    disabled={blocked}
                    onClick={() =>
                      operation({ op: "remove_span", spanId: s.id })
                    }
                  >
                    −
                  </button>
                </div>
              ))}
              <p>
                Deleting a referenced part requires an explicit brace choice.
                Undo restores both.
              </p>
            </section>
            <section className="panel-card bm-settings">
              <h2>Print settings</h2>
              <button
                disabled={blocked}
                onClick={() =>
                  start({
                    type: "print",
                    values: Object.fromEntries(
                      Object.entries(d.presentation).map(([k, v]) => [
                        k,
                        String(v),
                      ]),
                    ) as Extract<Draft, { type: "print" }>["values"],
                  })
                }
              >
                Edit print dimensions
              </button>
              <button
                disabled={blocked}
                onClick={() => operation({ op: "reveal_saved_answers" })}
              >
                Reveal saved answers
              </button>
              <p>
                One unit width is shared by every bar. Labels never calculate
                widths or answers. Editable files and links can contain hidden
                answers.
              </p>
            </section>
            {draft && active && (
              <section
                className="panel-card bm-draft"
                aria-label="Edit bar model"
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    cancelDraft();
                  }
                  if (
                    ev.key === "Enter" &&
                    (ev.target as HTMLElement).tagName !== "BUTTON"
                  ) {
                    ev.preventDefault();
                    applyDraft();
                  }
                }}
              >
                <h2>Edit bar model</h2>
                {draft.type === "label" &&
                  stateSelect(draft.label, (label) =>
                    setDraft({ ...draft, label }),
                  )}
                {draft.type === "part" && (
                  <>
                    <label>
                      Geometric weight
                      <input
                        autoFocus
                        aria-label="Geometric weight"
                        value={draft.weight}
                        onChange={(ev) =>
                          setDraft({ ...draft, weight: ev.target.value })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.shade}
                        onChange={(ev) =>
                          setDraft({ ...draft, shade: ev.target.checked })
                        }
                      />
                      Light shading
                    </label>
                  </>
                )}
                {draft.type === "alignment" && (
                  <label>
                    Offset in shared units
                    <input
                      autoFocus
                      aria-label="Offset in shared units"
                      value={draft.offset}
                      onChange={(ev) =>
                        setDraft({ ...draft, offset: ev.target.value })
                      }
                    />
                  </label>
                )}
                {draft.type === "print" &&
                  Object.entries(draft.values).map(([key, value]) => (
                    <label key={key}>
                      {key}
                      <input
                        aria-label={key}
                        value={value}
                        inputMode="decimal"
                        onChange={(ev) =>
                          setDraft({
                            ...draft,
                            values: { ...draft.values, [key]: ev.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                {draft.type === "span" && (
                  <>
                    {stateSelect(draft.span.label, (label) =>
                      setDraft({ ...draft, span: { ...draft.span, label } }),
                    )}
                    {(["from", "to"] as const).map((end) => (
                      <fieldset key={end}>
                        <legend>
                          {end === "from" ? "Start boundary" : "End boundary"}
                        </legend>
                        <label>
                          Bar
                          <select
                            aria-label={`${end} bar`}
                            value={draft.span[end].barId}
                            onChange={(ev) => {
                              const b = d.bars.find(
                                (b) => b.id === ev.target.value,
                              )!;
                              setDraft({
                                ...draft,
                                span: {
                                  ...draft.span,
                                  [end]: {
                                    ...draft.span[end],
                                    barId: b.id,
                                    partId: b.parts[0].id,
                                  },
                                },
                              });
                            }}
                          >
                            {d.bars.map((b) => (
                              <option key={b.id}>{b.id}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Part
                          <select
                            aria-label={`${end} part`}
                            value={draft.span[end].partId}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                span: {
                                  ...draft.span,
                                  [end]: {
                                    ...draft.span[end],
                                    partId: ev.target.value,
                                  },
                                },
                              })
                            }
                          >
                            {d.bars
                              .find((b) => b.id === draft.span[end].barId)!
                              .parts.map((p) => (
                                <option key={p.id}>{p.id}</option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Edge
                          <select
                            aria-label={`${end} edge`}
                            value={draft.span[end].edge}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                span: {
                                  ...draft.span,
                                  [end]: {
                                    ...draft.span[end],
                                    edge: ev.target.value,
                                  },
                                },
                              })
                            }
                          >
                            <option>start</option>
                            <option>end</option>
                          </select>
                        </label>
                      </fieldset>
                    ))}
                    <label>
                      Position
                      <select
                        value={draft.span.side}
                        onChange={(ev) =>
                          setDraft({
                            ...draft,
                            span: {
                              ...draft.span,
                              side: ev.target.value as c.Span["side"],
                            },
                          })
                        }
                      >
                        <option>above</option>
                        <option>below</option>
                      </select>
                    </label>
                    <label>
                      Mark
                      <select
                        value={draft.span.style}
                        onChange={(ev) =>
                          setDraft({
                            ...draft,
                            span: {
                              ...draft.span,
                              style: ev.target.value as c.Span["style"],
                            },
                          })
                        }
                      >
                        <option>brace</option>
                        <option>dimension</option>
                      </select>
                    </label>
                  </>
                )}
                {inputError && <p role="alert">{inputError}</p>}
                <div className="bm-pair">
                  <button onClick={applyDraft}>Apply</button>
                  <button onClick={cancelDraft}>Cancel</button>
                </div>
              </section>
            )}
          </aside>
        </section>
        {active && pending && (
          <RatioDialog
            title={pending.title}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              commit(pending.e);
              setPending(null);
            }}
            confirmLabel="Open bar model"
          >
            <p>
              Opening replaces this resource and can be undone. Cancel preserves
              current work. Editable files may contain hidden answers.
            </p>
            <div
              className="bm-import-preview"
              dangerouslySetInnerHTML={{ __html: c.renderSvg(pending.e) }}
            />
          </RatioDialog>
        )}
        {active && removal && (
          <RatioDialog
            title="Remove attached braces too?"
            onCancel={() => setRemoval(null)}
            onConfirm={() => {
              try {
                commit(
                  apply(e, [{ ...removal, discardSpans: true } as Operation]),
                );
                setRemoval(null);
              } catch (err) {
                setMessage(errorText(err));
                setRemoval(null);
              }
            }}
            confirmLabel="Remove structure and its braces"
          >
            <p>
              This removes braces anchored to the deleted structure. One Undo
              restores everything.
            </p>
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
