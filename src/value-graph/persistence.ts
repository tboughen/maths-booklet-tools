import {
  defaultEnvelope,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { housePreference } from "../site/houseStyle";
/** A new resource starts from the house style's lines (U111). */
export function freshValueGraph(): ValueEnvelope {
  const e = defaultEnvelope();
  if (housePreference().lines === "bold") e.document.print.lines = "bold";
  return e;
}
export const STORAGE_KEY = "mathsdock:value-table-graph:v1";
