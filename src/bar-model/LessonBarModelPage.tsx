import { pathLink } from "../site/routes";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as c from "../../packages/bar-model-core/src/versioned";
import * as v from "../../packages/bar-model-core/src/v2";
import { barLessonGalleryV2 } from "../examples/barLessonGalleryV2";
import { lessonExample as legacyLessonExample } from "../../packages/bar-model-core/src/lesson-examples";
import * as v3 from "../../packages/bar-model-core/src/v3";
import * as api from "../../packages/bar-model-core/src/versioned-interchange";
import {
  lessonExample,
  lessonExampleNames,
} from "../../packages/bar-model-core/src/lesson-examples-v3";
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
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, printPng, downloadImage, downloadEditable } from "./export";
import { saveStorage, type Startup } from "./storage";
import LegacyPage from "./BarModelPage";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { ExampleGallery } from "../examples/ExampleGallery";
import { barLessonGallery, lessonTitles } from "../examples/barLessonGallery";
import "./bar-model.css";
export interface History {
  past: c.Envelope[];
  present: c.Envelope;
  future: c.Envelope[];
}
type LabelTarget =
  | { kind: "section"; barId: string; partIds: string[]; slot: v.Slot }
  | { kind: "name"; barId: string }
  | { kind: "title" };
type Draft =
  | { kind: "label"; target: LabelTarget; label: c.Label }
  | { kind: "annotation"; annotation: v.Annotation }
  | {
      kind: "caption";
      caption: v.Envelope["document"]["captions"][number] & {
        format?: "maths" | "plain";
      };
      isNew: boolean;
    }
  | { kind: "structure"; barId: string; count: string; discard: boolean }
  | {
      kind: "part";
      barId: string;
      partId: string;
      weight: string;
      offset: string;
    }
  | {
      kind: "print";
      values: Record<
        "unitMm" | "barHeightMm" | "fontPt" | "titlePt" | "nameWidthMm",
        string
      >;
      autoName: boolean;
    }
  | {
      kind: "move";
      from: { barId: string; partId: string; slot: v.Slot };
      to: { barId: string; partId: string; slot: v.Slot };
      mode: "copy" | "move";
      overwrite: boolean;
    };
const error = (e: unknown) => (e instanceof Error ? e.message : String(e));
const stateNames = {
  value: "Print label",
  blank: "Leave blank",
  question: "Question mark",
  line: "Answer line",
  hidden: "Hide saved answer",
};
function LabelFields({
  value,
  onChange,
}: {
  value: c.Label;
  onChange: (l: c.Label) => void;
}) {
  return (
    <>
      <label>
        Saved label
        <input
          value={value.text}
          maxLength={80}
          onChange={(ev) =>
            onChange({
              text: ev.target.value,
              state:
                value.state === "blank" && !value.text ? "value" : value.state,
            })
          }
        />
      </label>
      <label>
        Pupil display
        <select
          aria-label="Pupil display"
          value={value.state}
          onChange={(ev) =>
            onChange({ ...value, state: ev.target.value as c.Label["state"] })
          }
        >
          {Object.entries(stateNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p>
        Blank, answer-line, question and hidden displays retain the saved text.
        This editor never calculates answers.
      </p>
    </>
  );
}
export default function LessonBarModelPage({
  active = true,
  startup,
  storageKey,
  initialHistory,
}: {
  active?: boolean;
  startup: Startup;
  storageKey: string;
  initialHistory?: History;
}) {
  const [history, setHistory] = useState<History>(
      initialHistory ?? { past: [], present: startup.envelope, future: [] },
    ),
    e = history.present;
  const profile = e.schemaVersion === 2 ? v : v3;
  const lesson = e.schemaVersion === 2 ? legacyLessonExample : lessonExample;
  const d = e.schemaVersion !== 1 ? e.document : null,
    g = useMemo(() => c.layout(e), [e]);
  const lessonGeometry = "annotations" in g ? g : null;
  const artwork = useMemo(() => c.renderSvg(e), [e]);
  const [draft, setDraft] = useState<Draft | null>(null),
    [draftError, setDraftError] = useState(""),
    [message, setMessage] = useState(startup.message),
    // Shared save vocabulary: green only when nothing is waiting on a recovery choice.
    [saveState, setSaveState] = useState(
      startup.recovery === undefined && !startup.alternate
        ? "Saved on this device"
        : "Not saved on this device yet",
    );
  const [pending, setPending] = useState<{
      envelope: c.Envelope;
      title: string;
      writingUpgrade?: boolean;
    } | null>(null),
    [alternate, setAlternate] = useState(startup.alternate),
    [recovery, setRecovery] = useState(startup.recovery),
    [conflict, setConflict] = useState(false);
  const [selectedBar, setSelectedBar] = useState(e.document.bars[0].id),
    [selectedParts, setSelectedParts] = useState<string[]>([]),
    [slot, setSlot] = useState<v.Slot>("inside"),
    [fill, setFill] = useState<(typeof v.fills)[number]>("neutral");
  const [comparisonLengths, setComparisonLengths] = useState(["5", "3"]),
    [count, setCount] = useState("5"),
    [ratio, setRatio] = useState("3:5"),
    [partitioned, setPartitioned] = useState(true),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(0);
  const expected = useRef(startup.expected),
    legacyHash = useRef(startup.legacySourceHash),
    dirty = useRef(false),
    file = useRef<HTMLInputElement>(null),
    editor = useRef<HTMLDivElement>(null);
  const blocked =
      !!draft ||
      !!pending ||
      !!alternate ||
      recovery !== undefined ||
      conflict ||
      busy ||
      !active,
    guard = useRef(blocked);
  guard.current = blocked;
  const currentBar = d?.bars.find((b) => b.id === selectedBar) ?? d?.bars[0],
    chosen =
      currentBar?.parts.filter((p) => selectedParts.includes(p.id)) ?? [],
    selection = chosen.length ? chosen : (currentBar?.parts ?? []);
  const fit = useResourceFit(
      (g.width * 96) / 25.4,
      (g.height * 96) / 25.4,
      zoom,
      120,
      100,
    ),
    px = (fit.scale * 96) / 25.4,
    issue = useMemo(() => c.exportIssue(e), [e]);
  const pendingIssue = pending?.writingUpgrade
    ? c.exportIssue(pending.envelope)
    : "";
  const upgradeOptions =
    pending?.writingUpgrade && pending.envelope.schemaVersion === 3 ? (
      <>
        <p>
          Answer lines reserve 12 mm above and 3 mm below. Actual bars:{" "}
          {v3.effectiveBarHeight(pending.envelope)} mm. One Undo restores the
          original file.
        </p>
        {pending.envelope.document.captions.length > 0 && (
          <label>
            <input
              type="checkbox"
              checked={pending.envelope.document.captions.every(
                (c) => c.format === "plain",
              )}
              onChange={(ev) => {
                const format = ev.target.checked
                  ? ("plain" as const)
                  : ("maths" as const);
                setPending((old) =>
                  old?.envelope.schemaVersion === 3
                    ? {
                        ...old,
                        envelope: {
                          ...old.envelope,
                          document: {
                            ...old.envelope.document,
                            captions: old.envelope.document.captions.map(
                              (c) => ({ ...c, format }),
                            ),
                          },
                        },
                      }
                    : old,
                );
              }}
            />
            Keep existing calculation lines as Plain text (for dates or literal
            slashes)
          </label>
        )}
        {pendingIssue && <p role="alert">{pendingIssue}</p>}
      </>
    ) : null;
  function commit(n: c.Envelope) {
    const valid = c.validate(n);
    dirty.current = true;
    setHistory((h) =>
      c.canonical(h.present) === c.canonical(valid)
        ? h
        : {
            past: [...h.past, h.present].slice(-60),
            present: valid,
            future: [],
          },
    );
    setMessage("");
  }
  function operation(ops: api.Operation[]) {
    if (guard.current) return;
    try {
      commit(api.apply(e, ops));
    } catch (err) {
      setMessage(error(err));
    }
  }
  function undo() {
    if (guard.current) return;
    dirty.current = true;
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past.at(-1)!,
            future: [h.present, ...h.future],
          }
        : h,
    );
  }
  function redo() {
    if (guard.current) return;
    dirty.current = true;
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
    setDraftError("");
    setDraft(n);
  }
  function editSection(barId: string, partId: string, position: v.Slot = slot) {
    if (!d) return;
    const p = d.bars
      .find((b) => b.id === barId)!
      .parts.find((p) => p.id === partId)!;
    setSelectedBar(barId);
    setSelectedParts([partId]);
    setSlot(position);
    start({
      kind: "label",
      target: { kind: "section", barId, partIds: [partId], slot: position },
      label: structuredClone(p.labels[position] ?? c.label()),
    });
  }
  function freshId(prefix: string) {
    const ids = new Set(
      d
        ? [
            ...d.bars.flatMap((b) => [b.id, ...b.parts.map((p) => p.id)]),
            ...d.annotations.map((a) => a.id),
            ...d.captions.map((c) => c.id),
          ]
        : [],
    );
    let i = 1;
    while (ids.has(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  }
  function applyDraft() {
    if (!draft || recovery !== undefined || conflict || !active) return;
    try {
      let ops: api.Operation[] = [];
      switch (draft.kind) {
        case "label": {
          const t = draft.target;
          ops =
            t.kind === "section"
              ? [
                  {
                    op: "set_section_labels",
                    barId: t.barId,
                    partIds: t.partIds,
                    slot: t.slot,
                    label: draft.label,
                  },
                ]
              : t.kind === "name"
                ? [
                    {
                      op: "set_quantity_name",
                      barId: t.barId,
                      label: draft.label,
                    },
                  ]
                : [{ op: "set_title", label: draft.label }];
          break;
        }
        case "annotation":
          ops = [{ op: "set_annotation", annotation: draft.annotation }];
          break;
        case "caption":
          ops = [
            {
              op: draft.isNew ? "add_caption" : "update_caption",
              caption: draft.caption,
            },
          ];
          break;
        case "structure":
          ops = [
            {
              op: "equal_sections",
              barId: draft.barId,
              count: Number(draft.count),
              discardContent: draft.discard,
            },
          ];
          break;
        case "part":
          ops = [
            {
              op: "set_relative_length",
              barId: draft.barId,
              partId: draft.partId,
              weight: draft.weight,
            },
            { op: "set_alignment", barId: draft.barId, offset: draft.offset },
          ];
          break;
        case "print": {
          if (
            Object.entries(draft.values).some(
              ([key, value]) =>
                !(draft.autoName && key === "nameWidthMm") && !value.trim(),
            )
          )
            throw Error(
              "Enter every print measurement, or Cancel. Empty measurements have not been saved.",
            );
          const presentation: Partial<v.Envelope["document"]["presentation"]> =
            Object.fromEntries(
              Object.entries(draft.values).map(([key, value]) => [
                key,
                Number(value),
              ]),
            );
          if (draft.autoName) delete presentation.nameWidthMm;
          ops = [
            { op: "set_presentation", presentation, autoName: draft.autoName },
          ];
          break;
        }
        case "move":
          ops = [
            {
              op: "move_or_copy_label",
              from: draft.from,
              to: draft.to,
              mode: draft.mode,
              overwrite: draft.overwrite,
            },
          ];
          break;
      }
      const next = api.apply(e, ops);
      commit(next);
      setDraft(null);
      setDraftError("");
      editor.current?.focus();
    } catch (err) {
      setDraftError(error(err));
    }
  }
  useEffect(() => {
    if (!dirty.current || recovery !== undefined || alternate || conflict)
      return;
    try {
      expected.current = saveStorage(
        localStorage,
        storageKey,
        expected.current,
        e,
        legacyHash.current,
      );
      dirty.current = false;
      setSaveState("Saved on this device");
    } catch (err) {
      setSaveState(error(err));
      if (error(err).startsWith("Another tab")) setConflict(true);
    }
  }, [e, storageKey, recovery, alternate, conflict]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue !== expected.current) {
        setConflict(true);
        setSaveState(
          "Another tab changed saved work; original versions protected",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [storageKey]);
  useEffect(() => {
    if (!active || e.schemaVersion === 1) return;
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
    if (!active) return;
    const changed = () => {
      if (!location.hash.startsWith("#bar-model=")) return;
      if (guard.current) {
        setMessage(
          "Finish or cancel the current edit before opening this link. The current model is protected.",
        );
        return;
      }
      try {
        const envelope = api.parseLink(location.href);
        window.history.replaceState(
          {},
          "",
          location.pathname + location.search,
        );
        setPending({ envelope, title: "Open linked bar model?" });
      } catch (err) {
        setMessage(error(err));
      }
    };
    changed();
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [active, blocked]);
  const drafting = draft !== null;
  useEffect(() => {
    if (drafting && active) {
      const panel = document.querySelector<HTMLElement>(".bm-draft");
      panel?.scrollIntoView({ block: "nearest" });
      panel?.querySelector<HTMLInputElement>("input,select")?.focus();
    }
  }, [drafting, active]);
  async function output(fn: () => Promise<unknown> | unknown, success = "") {
    if (guard.current || issue) return;
    setBusy(true);
    try {
      await fn();
      setMessage(success);
    } catch (err) {
      setMessage(error(err));
    } finally {
      setBusy(false);
    }
  }
  function replace(envelope: c.Envelope, title: string, worked = false) {
    if (guard.current) return;
    if (worked) commit(envelope);
    else setPending({ envelope, title });
  }
  function endpointControl(
    title: string,
    value: c.Anchor,
    onChange: (a: c.Anchor) => void,
  ): ReactNode {
    return (
      <label>
        {title}
        <select
          aria-label={title}
          value={JSON.stringify(value)}
          onChange={(ev) => onChange(JSON.parse(ev.target.value) as c.Anchor)}
        >
          {d?.bars.flatMap((bar, i) =>
            bar.parts.flatMap((p, j) =>
              (["start", "end"] as const).map((edge) => (
                <option
                  key={`${p.id}-${edge}`}
                  value={JSON.stringify({ barId: bar.id, partId: p.id, edge })}
                >{`Bar ${i + 1}, section ${j + 1}, ${edge}`}</option>
              )),
            ),
          )}
        </select>
      </label>
    );
  }
  const labelDraft =
    draft?.kind === "label"
      ? draft.label
      : draft?.kind === "annotation"
        ? draft.annotation.label
        : draft?.kind === "caption"
          ? draft.caption.label
          : null;
  const updateLabel = (label: c.Label) =>
    setDraft((old) =>
      old?.kind === "label"
        ? { ...old, label }
        : old?.kind === "annotation"
          ? { ...old, annotation: { ...old.annotation, label } }
          : old?.kind === "caption"
            ? { ...old, caption: { ...old.caption, label } }
            : old,
    );
  const legacyRecoveryNotice = startup.legacyRecovery ? (
    <section className="bm-settings" aria-label="Older saved data">
      <p>
        The older saved data is protected. Download it for recovery; the current
        model can still be edited.
      </p>
      <button
        disabled={!active}
        onClick={() =>
          downloadBlob(
            new Blob([startup.legacyRecovery!], { type: "application/json" }),
            "bar-model-older-recovery.json",
          )
        }
      >
        Download older saved data
      </button>
    </section>
  ) : null;
  if (
    e.schemaVersion === 1 &&
    !alternate &&
    recovery === undefined &&
    !conflict
  )
    return (
      <>
        {legacyRecoveryNotice}
        <LegacyPage
          active={
            active &&
            !pending &&
            !conflict &&
            recovery === undefined &&
            !alternate
          }
          managed={{
            present: e,
            onCommit: commit,
            onUndo: undo,
            onRedo: redo,
            canUndo: !!history.past.length,
            canRedo: !!history.future.length,
          }}
          onNewModel={() =>
            setPending({
              envelope: profile.fresh(),
              title: "Start a new model?",
            })
          }
          onUpgrade={() => commit(v.upgrade(e))}
          onUpgradeWriting={() =>
            setPending({
              envelope: v3.upgrade(e),
              writingUpgrade: true,
              title:
                "Use horizontal fractions and larger answer spaces? Fixed endpoints and saved answers are retained.",
            })
          }
          onOpenModern={(envelope) =>
            setPending({ envelope, title: "Open improved editable model?" })
          }
        />
        {pending && active && (
          <RatioDialog
            title={pending.title}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              commit(pending.envelope);
              setPending(null);
            }}
            confirmLabel="Open bar model"
            disabled={!!pendingIssue}
          >
            {upgradeOptions}
            <div
              className="bm-import-preview"
              dangerouslySetInnerHTML={{
                __html: c.renderSvg(pending.envelope),
              }}
            />
          </RatioDialog>
        )}
      </>
    );
  return (
    <div className="app-shell booklet-editor bm-editor bm-v2">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Bar modelling"
          description="Build simple part-whole, comparison, fraction and ratio models."
        >
          <ResourceSaveStatus
            text={saveState}
            state={
              saveState === "Not saved on this device yet"
                ? "pending"
                : undefined
            }
          />
        </PageHeading>
        {legacyRecoveryNotice}
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && !!history.past.length}
              canRedo={!blocked && !!history.future.length}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(profile.fresh(), "Start a new model?")}
              resetLabel="New model"
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void output(() => copyWord(e), "Copied for Word")}
              onCopyClipboard={() =>
                void output(
                  () => copyPngToClipboard(() => printPng(e)),
                  "Image copied",
                )
              }
              menuOpen={menu}
              onToggleMenu={() => setMenu((x) => !x)}
              menuId="bar-model-v2-files"
            />
            <EditorDownloadMenu
              id="bar-model-v2-files"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onMessage={setMessage}
              onBusyChange={setBusy}
              actions={[
                {
                  label: "Download PNG (600 ppi)",
                  action: () => downloadImage(e, "png"),
                  disabled: blocked || !!issue,
                },
                {
                  label: "Download SVG",
                  action: () => downloadImage(e, "svg"),
                  disabled: blocked || !!issue,
                },
                {
                  label: "Save editable file",
                  action: () => downloadEditable(e),
                  disabled: blocked,
                },
                {
                  label: "Copy editable link",
                  description: LINK_DESCRIPTION,
                  action: () =>
                    navigator.clipboard.writeText(
                      pathLink(api.editorLink(e, location.origin)),
                    ),
                  disabled: blocked || !!issue,
                },
                {
                  label: "Open editable file",
                  action: () => file.current?.click(),
                  picker: true,
                  disabled: blocked,
                },
              ]}
            />
            <input
              ref={file}
              hidden
              type="file"
              accept=".json,application/json"
              aria-label="Open bar model file"
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (!f || guard.current) return;
                try {
                  if (f.size > 32768)
                    throw Error("Editable file exceeds 32 KiB.");
                  const parsed = c.parseFile(await f.text());
                  if (!guard.current)
                    setPending({
                      envelope: parsed,
                      title: "Open editable model?",
                    });
                } catch (err) {
                  setMessage(error(err));
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
                style={{ width: g.width * px, minHeight: g.height * px }}
              >
                <div
                  className="bm-resource"
                  ref={editor}
                  tabIndex={-1}
                  style={{ width: g.width * px, height: g.height * px }}
                >
                  <div
                    className="bm-art"
                    dangerouslySetInnerHTML={{ __html: artwork }}
                  />
                  {e.schemaVersion !== 1 &&
                    lessonGeometry?.rows.map((r, i) => (
                      <div key={r.bar.id}>
                        <button
                          className="bm-hit"
                          disabled={blocked}
                          aria-label={`Edit quantity name for bar ${i + 1}`}
                          style={{
                            left: 0,
                            top: r.y * px,
                            width: Math.max(4, lessonGeometry.gutter) * px,
                            height: r.height * px,
                          }}
                          onClick={() =>
                            start({
                              kind: "label",
                              target: { kind: "name", barId: r.bar.id },
                              label: structuredClone(r.bar.name),
                            })
                          }
                        />
                        {r.parts.flatMap((p, j) =>
                          v.slots
                            .filter((s) => s === "inside" || p.part.labels[s])
                            .map((s) => (
                              <button
                                key={`${p.part.id}-${s}`}
                                className="bm-hit"
                                disabled={blocked}
                                aria-label={`Edit bar ${i + 1} section ${j + 1} ${s} label`}
                                style={{
                                  left: p.x * px,
                                  top:
                                    (s === "inside"
                                      ? r.y
                                      : s === "above"
                                        ? r.y - r.aboveSection - 1
                                        : r.y + r.height + 1) * px,
                                  width: p.width * px,
                                  height:
                                    (s === "inside"
                                      ? e.schemaVersion === 3
                                        ? v3.effectiveBarHeight(e)
                                        : e.document.presentation.barHeightMm
                                      : Math.max(
                                          g.font * 1.2,
                                          s === "above"
                                            ? r.aboveSection
                                            : r.belowSection,
                                        )) * px,
                                }}
                                onClick={() =>
                                  editSection(r.bar.id, p.part.id, s)
                                }
                              />
                            )),
                        )}
                      </div>
                    ))}
                  {e.schemaVersion !== 1 &&
                    lessonGeometry?.annotations.map((a, i) => (
                      <button
                        key={a.annotation.id}
                        className="bm-hit"
                        disabled={blocked}
                        aria-label={`Edit annotation ${i + 1}`}
                        style={{
                          left: Math.min(a.x1, a.textLeft) * px,
                          top: (a.textY - a.labelHeight / 2 - 1) * px,
                          width:
                            Math.max(a.x2 - a.x1, a.textRight - a.textLeft) *
                            px,
                          height: Math.max(4, a.labelHeight + 2) * px,
                        }}
                        onClick={() =>
                          start({
                            kind: "annotation",
                            annotation: structuredClone(a.annotation),
                          })
                        }
                      />
                    ))}
                </div>
                {currentBar && (
                  <div
                    className="bm-side-controls"
                    style={{
                      top: Math.max(
                        4,
                        24 +
                          (g.rows.find((r) => r.bar.id === currentBar.id)?.y ??
                            0) *
                            px,
                      ),
                    }}
                  >
                    <button
                      disabled={blocked || currentBar.parts.length >= 24}
                      onClick={() =>
                        operation([
                          {
                            op: "append_section",
                            barId: currentBar.id,
                            part: {
                              id: freshId("section"),
                              weight: "1",
                              labels: { inside: c.label() },
                              fill: "none",
                            },
                          },
                        ])
                      }
                    >
                      + Section
                    </button>
                    <button
                      disabled={blocked || currentBar.parts.length <= 1}
                      onClick={() => {
                        const p = currentBar.parts.at(-1)!;
                        try {
                          setPending({
                            envelope: api.apply(e, [
                              {
                                op: "remove_part",
                                barId: currentBar.id,
                                partId: p.id,
                                discardSpans: true,
                              },
                            ]),
                            title:
                              "Remove last section and its fixed annotations? Saved labels on this section will be discarded. Undo restores them.",
                          });
                        } catch (err) {
                          setMessage(error(err));
                        }
                      }}
                    >
                      − Section
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p role="status" className="editor-feedback">
              {message}
            </p>
            {issue && <p role="alert">{issue}</p>}
            {c.warnings(e).map((w) => (
              <p key={w}>{w}</p>
            ))}
            {e.schemaVersion === 2 && (
              <div className="bm-settings">
                <p>This saved model keeps its original notation and spacing.</p>
                <button
                  disabled={blocked}
                  onClick={() =>
                    setPending({
                      envelope: v3.upgrade(e),
                      writingUpgrade: true,
                      title:
                        "Use horizontal fractions and larger answer spaces? Fixed endpoints and saved answers are retained.",
                    })
                  }
                >
                  Use horizontal fractions and larger answer spaces
                </button>
              </div>
            )}
            {e.schemaVersion === 1 && (
              <div className="bm-settings">
                <p>
                  Legacy layout and source are preserved. Undo has restored the
                  original version.
                </p>
                <button
                  disabled={blocked}
                  onClick={() =>
                    setPending({
                      envelope: v.upgrade(e),
                      title:
                        "Use improved layout? Fixed endpoints and saved answers are retained.",
                    })
                  }
                >
                  Use improved layout
                </button>
              </div>
            )}
          </Panel>
          <div className="inspector-stack">
            <ExampleGallery
              examples={
                e.schemaVersion === 2 ? barLessonGalleryV2 : barLessonGallery
              }
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, title)}
              onWorked={(resource) => replace(resource, "", true)}
            />
            {(alternate || recovery !== undefined || conflict) && (
              <Panel>
                <div
                  className="bm-settings"
                  role="region"
                  aria-label="Recovery"
                >
                  <h2>Choose saved work</h2>
                  <p>
                    {recovery !== undefined
                      ? "The original bytes are protected. Download them before choosing a new model."
                      : "Saved versions differ. Review both before choosing which to edit."}
                  </p>
                  <button
                    onClick={() =>
                      downloadBlob(
                        new Blob([recovery ?? expected.current ?? ""], {
                          type: "application/json",
                        }),
                        "bar-model-saved-recovery.json",
                      )
                    }
                  >
                    Download protected saved data
                  </button>
                  <button onClick={() => downloadEditable(e)}>
                    Download current editable model
                  </button>
                  {alternate && (
                    <>
                      <div
                        className="bm-choice-preview"
                        dangerouslySetInnerHTML={{
                          __html: c.renderSvg(alternate),
                        }}
                      />
                      <button onClick={() => downloadEditable(alternate)}>
                        Download other saved model
                      </button>
                      <button
                        onClick={() => {
                          const n = alternate;
                          legacyHash.current = startup.observedLegacyHash;
                          setAlternate(undefined);
                          dirty.current = true;
                          commit(n);
                        }}
                      >
                        Use other saved model
                      </button>
                    </>
                  )}
                  {recovery === undefined && !conflict && (
                    <button
                      onClick={() => {
                        legacyHash.current = startup.observedLegacyHash;
                        setAlternate(undefined);
                        dirty.current = true;
                        setHistory((h) => ({ ...h }));
                      }}
                    >
                      Keep current model
                    </button>
                  )}
                  {(recovery !== undefined || conflict) && (
                    <button
                      onClick={() => {
                        downloadBlob(
                          new Blob(
                            [
                              localStorage.getItem(storageKey) ??
                                recovery ??
                                "",
                            ],
                            { type: "application/json" },
                          ),
                          "bar-model-original-data.json",
                        );
                        expected.current = localStorage.getItem(storageKey);
                        setRecovery(undefined);
                        setConflict(false);
                        setAlternate(undefined);
                        dirty.current = true;
                        setHistory((h) => ({ ...h }));
                      }}
                    >
                      Download original and use current model
                    </button>
                  )}
                </div>
              </Panel>
            )}
            {pending && active && (
              <RatioDialog
                title={pending.title}
                disabled={!!pendingIssue}
                onCancel={() => setPending(null)}
                confirmLabel={
                  pending.title.startsWith("Open")
                    ? "Open bar model"
                    : "Use this model"
                }
                onConfirm={() => {
                  commit(pending.envelope);
                  setSelectedBar(pending.envelope.document.bars[0].id);
                  setSelectedParts([]);
                  setPending(null);
                }}
              >
                {upgradeOptions}
                <div
                  className="bm-choice-preview"
                  dangerouslySetInnerHTML={{
                    __html: c.renderSvg(pending.envelope),
                  }}
                />
              </RatioDialog>
            )}
            {draft && (
              <Panel>
                <form
                  className="bm-draft"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    applyDraft();
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Escape") {
                      ev.preventDefault();
                      setDraft(null);
                      setDraftError("");
                    }
                  }}
                >
                  <h2>
                    Edit{" "}
                    {draft.kind === "label"
                      ? "label"
                      : draft.kind === "part"
                        ? "relative lengths"
                        : draft.kind === "print"
                          ? "print settings"
                          : draft.kind}
                  </h2>
                  {draft.kind === "label" &&
                    draft.target.kind === "section" && (
                      <p>
                        {draft.target.partIds.length} selected section(s),{" "}
                        {draft.target.slot} slot. This applies the literal label
                        once; it creates no continuing link.
                      </p>
                    )}
                  {labelDraft && (
                    <LabelFields value={labelDraft} onChange={updateLabel} />
                  )}
                  {draft.kind === "annotation" && (
                    <>
                      <label>
                        Scope
                        <select
                          aria-label="Scope"
                          value={draft.annotation.scope.kind}
                          onChange={(ev) => {
                            if (!currentBar) return;
                            const scope: v.Annotation["scope"] =
                              ev.target.value === "whole"
                                ? { kind: "whole", barId: currentBar.id }
                                : {
                                    kind: "range",
                                    from: {
                                      barId: currentBar.id,
                                      partId: currentBar.parts[0].id,
                                      edge: "start",
                                    },
                                    to: {
                                      barId: currentBar.id,
                                      partId: currentBar.parts.at(-1)!.id,
                                      edge: "end",
                                    },
                                  };
                            setDraft({
                              ...draft,
                              annotation: { ...draft.annotation, scope },
                            });
                          }}
                        >
                          <option value="whole">
                            Whole bar (follows added sections)
                          </option>
                          <option value="range">
                            Fixed section boundaries
                          </option>
                        </select>
                      </label>
                      {draft.annotation.scope.kind === "whole" ? (
                        <label>
                          Whole bar
                          <select
                            aria-label="Whole bar"
                            value={draft.annotation.scope.barId}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                annotation: {
                                  ...draft.annotation,
                                  scope: {
                                    kind: "whole",
                                    barId: ev.target.value,
                                  },
                                },
                              })
                            }
                          >
                            {d?.bars.map((b, i) => (
                              <option key={b.id} value={b.id}>
                                Bar {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <>
                          {endpointControl(
                            "From boundary",
                            draft.annotation.scope.from,
                            (from) => {
                              if (draft.annotation.scope.kind === "range")
                                setDraft({
                                  ...draft,
                                  annotation: {
                                    ...draft.annotation,
                                    scope: { ...draft.annotation.scope, from },
                                  },
                                });
                            },
                          )}
                          {endpointControl(
                            "To boundary",
                            draft.annotation.scope.to,
                            (to) => {
                              if (draft.annotation.scope.kind === "range")
                                setDraft({
                                  ...draft,
                                  annotation: {
                                    ...draft.annotation,
                                    scope: { ...draft.annotation.scope, to },
                                  },
                                });
                            },
                          )}
                        </>
                      )}
                      <label>
                        Decoration
                        <select
                          aria-label="Decoration"
                          value={draft.annotation.decoration}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              annotation: {
                                ...draft.annotation,
                                decoration: ev.target
                                  .value as v.Annotation["decoration"],
                              },
                            })
                          }
                        >
                          {["none", "brace", "dimension"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Placement
                        <select
                          aria-label="Placement"
                          value={draft.annotation.placement}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              annotation: {
                                ...draft.annotation,
                                placement: ev.target
                                  .value as v.Annotation["placement"],
                              },
                            })
                          }
                        >
                          {["above", "below", "inside", "between"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <p>
                        Inside totals must clear all dividers. Between-bar
                        differences attach to adjacent bars; moving bars never
                        silently changes the gap.
                      </p>
                    </>
                  )}
                  {draft.kind === "caption" && (
                    <>
                      {e.schemaVersion === 3 && (
                        <label>
                          Line format
                          <select
                            aria-label="Line format"
                            value={draft.caption.format ?? "maths"}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                caption: {
                                  ...draft.caption,
                                  format: ev.target.value as "maths" | "plain",
                                },
                              })
                            }
                          >
                            <option value="maths">
                              Maths — horizontal fractions
                            </option>
                            <option value="plain">
                              Plain text — literal slashes
                            </option>
                          </select>
                        </label>
                      )}
                      <label>
                        Alignment
                        <select
                          aria-label="Alignment"
                          value={draft.caption.alignment}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              caption: {
                                ...draft.caption,
                                alignment: ev.target.value as
                                  | "left"
                                  | "centre"
                                  | "right",
                              },
                            })
                          }
                        >
                          {["left", "centre", "right"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {draft.kind === "structure" && (
                    <>
                      <label>
                        Number of equal sections
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={draft.count}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              count: ev.target.value,
                              discard: false,
                            })
                          }
                        />
                      </label>
                      <p>
                        Total relative length is preserved exactly. The shared
                        unit width and other bars stay as entered.
                      </p>
                      <ul>
                        {(() => {
                          try {
                            return api
                              .affectedContent(
                                e as v.Envelope,
                                draft.barId,
                                Number(draft.count),
                              )
                              .map((s) => <li key={s}>{s}</li>);
                          } catch {
                            return <li>Choose a valid count.</li>;
                          }
                        })()}
                      </ul>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.discard}
                          onChange={(ev) =>
                            setDraft({ ...draft, discard: ev.target.checked })
                          }
                        />
                        Discard listed labels, fills and fixed annotations when
                        replacing sections
                      </label>
                    </>
                  )}
                  {draft.kind === "part" && (
                    <>
                      <label>
                        Relative length
                        <input
                          value={draft.weight}
                          onChange={(ev) =>
                            setDraft({ ...draft, weight: ev.target.value })
                          }
                        />
                      </label>
                      <label>
                        Bar offset in shared units
                        <input
                          value={draft.offset}
                          onChange={(ev) =>
                            setDraft({ ...draft, offset: ev.target.value })
                          }
                        />
                      </label>
                      <p>
                        Use exact integers, decimals or fractions. Printed
                        labels never determine lengths.
                      </p>
                    </>
                  )}
                  {draft.kind === "print" && (
                    <>
                      {(
                        ["unitMm", "barHeightMm", "fontPt", "titlePt"] as const
                      ).map((key) => (
                        <label key={key}>
                          {
                            {
                              unitMm: "Shared unit width (mm)",
                              barHeightMm:
                                e.schemaVersion === 3
                                  ? "Minimum bar height (mm)"
                                  : "Bar height (mm)",
                              fontPt: "Label size (pt)",
                              titlePt: "Title size (pt)",
                            }[key]
                          }
                          <input
                            type="number"
                            value={draft.values[key]}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  [key]: ev.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.autoName}
                          onChange={(ev) =>
                            setDraft({ ...draft, autoName: ev.target.checked })
                          }
                        />
                        Automatic name gutter
                      </label>
                      {!draft.autoName && (
                        <label>
                          Name width (mm)
                          <input
                            type="number"
                            min={8}
                            max={60}
                            value={draft.values.nameWidthMm ?? 28}
                            onChange={(ev) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  nameWidthMm: ev.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      )}
                    </>
                  )}
                  {draft.kind === "move" && (
                    <>
                      <p>
                        Source saved text:{" "}
                        {d?.bars
                          .find((b) => b.id === draft.from.barId)
                          ?.parts.find((p) => p.id === draft.from.partId)
                          ?.labels[draft.from.slot]?.text || "(empty)"}
                      </p>
                      <label>
                        Action
                        <select
                          aria-label="Action"
                          value={draft.mode}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              mode: ev.target.value as "move" | "copy",
                            })
                          }
                        >
                          <option value="copy">Copy</option>
                          <option value="move">Move</option>
                        </select>
                      </label>
                      <label>
                        Destination section
                        <select
                          aria-label="Destination section"
                          value={JSON.stringify({
                            barId: draft.to.barId,
                            partId: draft.to.partId,
                          })}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              to: {
                                ...draft.to,
                                ...JSON.parse(ev.target.value),
                              },
                              overwrite: false,
                            })
                          }
                        >
                          {d?.bars.flatMap((b, i) =>
                            b.parts.map((p, j) => (
                              <option
                                key={p.id}
                                value={JSON.stringify({
                                  barId: b.id,
                                  partId: p.id,
                                })}
                              >
                                Bar {i + 1}, section {j + 1}
                              </option>
                            )),
                          )}
                        </select>
                      </label>
                      <label>
                        Destination slot
                        <select
                          aria-label="Destination slot"
                          value={draft.to.slot}
                          onChange={(ev) =>
                            setDraft({
                              ...draft,
                              to: {
                                ...draft.to,
                                slot: ev.target.value as v.Slot,
                              },
                              overwrite: false,
                            })
                          }
                        >
                          {v.slots.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <p>
                        Destination saved text:{" "}
                        {d?.bars
                          .find((b) => b.id === draft.to.barId)
                          ?.parts.find((p) => p.id === draft.to.partId)?.labels[
                          draft.to.slot
                        ]?.text || "(empty)"}
                      </p>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.overwrite}
                          onChange={(ev) =>
                            setDraft({ ...draft, overwrite: ev.target.checked })
                          }
                        />
                        Overwrite destination, including retained hidden content
                      </label>
                    </>
                  )}
                  {draftError && <p role="alert">{draftError}</p>}
                  <div className="bm-actions">
                    <button type="submit">Apply</button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(null);
                        setDraftError("");
                        editor.current?.focus();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Panel>
            )}
            <Panel>
              <div className="bm-settings">
                <h2>Start a model</h2>
                <label>
                  Equal sections
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={count}
                    disabled={blocked}
                    onChange={(ev) => setCount(ev.target.value)}
                  />
                </label>
                {comparisonLengths.map((length, i) => (
                  <label key={i}>
                    {i === 0
                      ? "Longer bar length (shared units)"
                      : "Shorter bar length (shared units)"}
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={length}
                      disabled={blocked}
                      onChange={(ev) =>
                        setComparisonLengths((values) =>
                          values.map((value, j) =>
                            j === i ? ev.target.value : value,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  Ratio groups
                  <input
                    value={ratio}
                    disabled={blocked}
                    onChange={(ev) => setRatio(ev.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={partitioned}
                    disabled={blocked}
                    onChange={(ev) => setPartitioned(ev.target.checked)}
                  />
                  Show equal units in comparison
                </label>
                <div className="bm-actions">
                  {v.starters.map((starter) => (
                    <button
                      key={starter}
                      disabled={blocked}
                      onClick={() => {
                        try {
                          replace(
                            profile.fresh(
                              starter,
                              Number(count),
                              ratio.split(":").map(Number),
                              partitioned,
                              comparisonLengths.map(Number),
                            ),
                            `Start ${starter.replaceAll("-", " ")}?`,
                          );
                        } catch (err) {
                          setMessage(error(err));
                        }
                      }}
                    >
                      {
                        {
                          "part-whole": "Part-whole",
                          comparison: "Comparison",
                          "equal-sections": "Equal sections",
                          "inline-ratio": "Inline ratio",
                        }[starter]
                      }
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
            {d && currentBar && (
              <Panel>
                <div className="bm-settings">
                  <h2>Sections and labels</h2>
                  <label>
                    Bar
                    <select
                      aria-label="Bar"
                      value={currentBar.id}
                      disabled={blocked}
                      onChange={(ev) => {
                        setSelectedBar(ev.target.value);
                        setSelectedParts([]);
                      }}
                    >
                      {d.bars.map((b, i) => (
                        <option key={b.id} value={b.id}>
                          Bar {i + 1}
                          {c.visible(b.name) ? `: ${c.visible(b.name)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        kind: "label",
                        target: { kind: "name", barId: currentBar.id },
                        label: structuredClone(currentBar.name),
                      })
                    }
                  >
                    Edit quantity name
                  </button>
                  <label>
                    Label position
                    <select
                      aria-label="Label position"
                      value={slot}
                      disabled={blocked}
                      onChange={(ev) => setSlot(ev.target.value as v.Slot)}
                    >
                      {v.slots.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Choose a position, then edit that independent label.
                    Selecting a position never moves a label.
                  </p>
                  <div className="bm-section-list">
                    {currentBar.parts.map((p, i) => (
                      <div key={p.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedParts.includes(p.id)}
                            disabled={blocked}
                            onChange={(ev) =>
                              setSelectedParts((ids) =>
                                ev.target.checked
                                  ? [...ids, p.id]
                                  : ids.filter((id) => id !== p.id),
                              )
                            }
                          />
                          Section {i + 1}
                        </label>
                        <button
                          disabled={blocked}
                          onClick={() => editSection(currentBar.id, p.id)}
                        >
                          Edit {slot} label
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            start({
                              kind: "part",
                              barId: currentBar.id,
                              partId: p.id,
                              weight: p.weight,
                              offset: currentBar.offset,
                            })
                          }
                        >
                          Relative length
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={blocked}
                    onClick={() => {
                      setSelectedParts(currentBar.parts.map((p) => p.id));
                    }}
                  >
                    Select all sections
                  </button>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        kind: "label",
                        target: {
                          kind: "section",
                          barId: currentBar.id,
                          partIds: selection.map((p) => p.id),
                          slot,
                        },
                        label: c.label(),
                      })
                    }
                  >
                    Set {slot} labels for{" "}
                    {chosen.length ? "selection" : "whole bar"}
                  </button>
                  <button
                    disabled={blocked || chosen.length !== 1}
                    onClick={() => {
                      const from = {
                        barId: currentBar.id,
                        partId: chosen[0].id,
                        slot,
                      };
                      start({
                        kind: "move",
                        from,
                        to: {
                          ...from,
                          slot: slot === "inside" ? "above" : "inside",
                        },
                        mode: "copy",
                        overwrite: false,
                      });
                    }}
                  >
                    Move or copy selected label
                  </button>
                  <label>
                    Fill
                    <select
                      aria-label="Fill"
                      value={fill}
                      disabled={blocked}
                      onChange={(ev) => setFill(ev.target.value as typeof fill)}
                    >
                      {v.fills.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      operation([
                        {
                          op: "set_fill",
                          barId: currentBar.id,
                          partIds: selection.map((p) => p.id),
                          fill,
                        },
                      ])
                    }
                  >
                    Apply fill to {chosen.length ? "selection" : "whole bar"}
                  </button>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        kind: "structure",
                        barId: currentBar.id,
                        count: String(currentBar.parts.length),
                        discard: false,
                      })
                    }
                  >
                    Make equal sections
                  </button>
                  <button
                    disabled={blocked || d.bars.length >= 6}
                    onClick={() => {
                      const id = freshId("bar"),
                        partId = freshId("section");
                      operation([
                        {
                          op: "append_bar",
                          bar: {
                            id,
                            name: c.label(),
                            offset: "0",
                            parts: [
                              {
                                id: partId,
                                weight: "1",
                                labels: { inside: c.label() },
                                fill: "none",
                              },
                            ],
                          },
                        },
                      ]);
                    }}
                  >
                    Add bar
                  </button>
                  <button
                    disabled={blocked || d.bars.length <= 1}
                    onClick={() => {
                      try {
                        setPending({
                          envelope: api.apply(e, [
                            {
                              op: "remove_bar",
                              barId: currentBar.id,
                              discardSpans: true,
                            },
                          ]),
                          title:
                            "Remove this bar and its annotations? Saved labels will be discarded. Undo restores them.",
                        });
                      } catch (err) {
                        setMessage(error(err));
                      }
                    }}
                  >
                    Remove bar
                  </button>
                  <button
                    disabled={blocked || d.bars.length < 2}
                    onClick={() => {
                      const ids = d.bars.map((b) => b.id),
                        index = ids.indexOf(currentBar.id);
                      if (index > 0)
                        [ids[index - 1], ids[index]] = [
                          ids[index],
                          ids[index - 1],
                        ];
                      operation([{ op: "reorder_bars", barIds: ids }]);
                    }}
                  >
                    Move bar up
                  </button>
                </div>
              </Panel>
            )}
            {d && currentBar && (
              <Panel>
                <div className="bm-settings">
                  <h2>Whole labels and ranges</h2>
                  {d.annotations.map((a, i) => (
                    <div className="bm-actions" key={a.id}>
                      <button
                        disabled={blocked}
                        onClick={() =>
                          start({
                            kind: "annotation",
                            annotation: structuredClone(a),
                          })
                        }
                      >
                        Edit {a.scope.kind === "whole" ? "whole bar" : "range"}{" "}
                        annotation {i + 1}
                      </button>
                      <button
                        disabled={blocked}
                        onClick={() =>
                          operation([
                            { op: "remove_annotation", annotationId: a.id },
                          ])
                        }
                      >
                        Remove annotation {i + 1}
                      </button>
                    </div>
                  ))}
                  <button
                    disabled={blocked || d.annotations.length >= 18}
                    onClick={() =>
                      start({
                        kind: "annotation",
                        annotation: {
                          id: freshId("annotation"),
                          scope: { kind: "whole", barId: currentBar.id },
                          label: c.label(),
                          decoration: "brace",
                          placement: "above",
                        },
                      })
                    }
                  >
                    Add whole or range label
                  </button>
                </div>
              </Panel>
            )}
            {d && (
              <Panel>
                <div className="bm-settings">
                  <h2>Title and calculations</h2>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        kind: "label",
                        target: { kind: "title" },
                        label: structuredClone(d.title ?? c.label()),
                      })
                    }
                  >
                    Edit title
                  </button>
                  {d.captions.map((caption, i) => (
                    <div key={caption.id} className="bm-actions">
                      <button
                        disabled={blocked}
                        onClick={() =>
                          start({
                            kind: "caption",
                            caption: structuredClone(caption),
                            isNew: false,
                          })
                        }
                      >
                        Edit calculation line {i + 1}
                      </button>
                      <button
                        disabled={blocked}
                        onClick={() =>
                          operation([
                            { op: "remove_caption", captionId: caption.id },
                          ])
                        }
                      >
                        Remove line {i + 1}
                      </button>
                    </div>
                  ))}
                  <button
                    disabled={blocked || d.captions.length >= 3}
                    onClick={() =>
                      start({
                        kind: "caption",
                        caption: {
                          id: freshId("caption"),
                          label: c.label(),
                          alignment: "centre",
                          ...(e.schemaVersion === 3
                            ? { format: "maths" as const }
                            : {}),
                        },
                        isNew: true,
                      })
                    }
                  >
                    Add calculation line
                  </button>
                  <p>
                    {e.schemaVersion === 3
                      ? "Type / in Maths lines for a horizontal fraction, for example 4/5 × 45 = 36. Choose Plain text explicitly for dates or literal slashes."
                      : "This saved v2 model retains literal calculation lines. Upgrade above for horizontal fractions and handwriting space."}{" "}
                    No answers are calculated.
                  </p>
                  <label>
                    Output
                    <select
                      aria-label="Output"
                      value={d.presentation.output}
                      disabled={blocked}
                      onChange={(ev) =>
                        operation([
                          {
                            op: "set_presentation",
                            presentation: {
                              output: ev.target.value as "grey" | "colour",
                            },
                          },
                        ])
                      }
                    >
                      <option value="grey">Greyscale</option>
                      <option value="colour">Colour</option>
                    </select>
                  </label>
                  {e.schemaVersion === 3 && (
                    <p>
                      Minimum bar height {d.presentation.barHeightMm} mm; actual
                      bars {v3.effectiveBarHeight(e)} mm. Answer lines have 12
                      mm clear above and 3 mm below.
                    </p>
                  )}
                  <button
                    disabled={blocked}
                    onClick={() =>
                      start({
                        kind: "print",
                        values: {
                          unitMm: String(d.presentation.unitMm),
                          barHeightMm: String(d.presentation.barHeightMm),
                          fontPt: String(d.presentation.fontPt),
                          titlePt: String(d.presentation.titlePt),
                          nameWidthMm: String(d.presentation.nameWidthMm ?? 28),
                        },
                        autoName: d.presentation.nameWidthMm === undefined,
                      })
                    }
                  >
                    Print settings
                  </button>
                  <details>
                    <summary>Advanced identifiers</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          bars: d.bars.map((b) => ({
                            id: b.id,
                            sections: b.parts.map((p) => p.id),
                          })),
                          annotations: d.annotations.map((a) => a.id),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </Panel>
            )}
            <Panel>
              <div className="bm-settings">
                <h2>Lesson examples</h2>
                <p>
                  Independent teaching examples based on the supplied
                  structures. Worked versions replace the current model; one
                  Undo restores it.
                </p>
                {lessonExampleNames.map((name) => (
                  <div key={name} className="bm-actions">
                    <span>{lessonTitles[name]}</span>
                    <button
                      disabled={blocked}
                      onClick={() =>
                        replace(lesson(name), `Open ${name} pupil model?`)
                      }
                    >
                      Pupil model {name}
                    </button>
                    <button
                      disabled={blocked}
                      onClick={() => replace(lesson(name, true), "", true)}
                    >
                      Worked {name}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}
