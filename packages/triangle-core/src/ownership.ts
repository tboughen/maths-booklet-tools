import { nameOf, type Envelope } from "./model";

export const triangleName = (e: Envelope, id: string) => {
  const t = e.document.triangles.find((t) => t.id === id);
  return t ? t.vertices.map((v) => nameOf(e, v) || v).join("") : id;
};
export function owningTriangles(e: Envelope, ref: string) {
  const [kind, id] = ref.split(":");
  return e.document.triangles.filter((t) => {
    if (kind === "t") return t.id === id;
    if (kind === "r") return t.id === id;
    if (kind === "v") return t.vertices.includes(id);
    if (kind === "e") {
      const edge = e.document.edges.find((v) => v.id === id);
      return (
        !!edge && t.vertices.includes(edge.from) && t.vertices.includes(edge.to)
      );
    }
    if (kind === "a")
      return e.document.angles.some(
        (a) => a.id === id && a.id.startsWith(t.id + "-"),
      );
    if (kind === "h")
      return e.document.heights.some(
        (h) => h.id === id && h.triangleId === t.id,
      );
    return kind === "c";
  });
}
