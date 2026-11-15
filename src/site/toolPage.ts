import { createContext } from "react";
import type { ToolId } from "./routes";

/** The diagram tool whose page is being drawn, so its heading can offer the tool switcher. */
export const ToolPageContext = createContext<ToolId | null>(null);
