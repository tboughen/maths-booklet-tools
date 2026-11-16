import { createContext } from "react";

/**
 * Told when the steps of the document drawn inside it change: "changed" for a new step, an undo
 * or a redo that leaves steps to undo, and "undone" when every step has been undone. The site
 * uses it to list the page under Home's "Carry on". Selection and other `replace` changes say nothing.
 */
export const DocumentChangeContext = createContext<((state: "changed" | "undone") => void) | null>(null);
