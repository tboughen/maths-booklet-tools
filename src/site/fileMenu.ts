import { LINK_DESCRIPTION, SAVE_DESCRIPTION, SAVE_EDITABLE_LABEL, type DownloadAction } from "./EditorDownloadMenu";

export type FileMenuItem = Omit<DownloadAction, "label" | "separator" | "description">;
/**
 * The one File menu for diagram editors (improvement item U4): the same items, order, notes and separators in
 * every tool. Pages give only what each item does; the labels and hidden-answer notes are defined here.
 */
export function diagramFileMenu(items: {
  svg: FileMenuItem;
  png: FileMenuItem;
  /** The diagram on an A4 or A3 PDF page at actual size (U32). */
  pdf?: FileMenuItem;
  /** Teacher copies with hidden answers printed, for tools that offer them. */
  answers?: { svg: FileMenuItem; png: FileMenuItem };
  save: FileMenuItem;
  open: FileMenuItem;
  link: FileMenuItem;
}): DownloadAction[] {
  return [
    { ...items.svg, label: "Download SVG" },
    { ...items.png, label: "Download PNG (600 ppi)" },
    ...(items.pdf ? [{ ...items.pdf, label: "Download PDF (actual size)" }] : []),
    ...(items.answers
      ? [
          { ...items.answers.svg, label: "Download answers SVG", description: "Hidden answers printed in the answer colour." },
          { ...items.answers.png, label: "Download answers PNG (600 ppi)" },
        ]
      : []),
    { ...items.save, label: SAVE_EDITABLE_LABEL, description: SAVE_DESCRIPTION, separator: true },
    { picker: true, ...items.open, label: "Open editable file" },
    { ...items.link, label: "Copy editable link", description: LINK_DESCRIPTION },
  ];
}

