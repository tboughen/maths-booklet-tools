import { zipSync } from "fflate";
import { GraphError } from "../../packages/graph-core/src/interchange";
export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
export const MAX_MEMBER_BYTES = 20 * 1024 * 1024;
export const ARCHIVE_NAMES = ["source.json", "diagram.svg", "diagram.png", "print-info.json", "README.txt"];
export function validateArchiveMembers(members: Record<string, Uint8Array>) {
  if (Object.keys(members).length !== ARCHIVE_NAMES.length || ARCHIVE_NAMES.some((n) => !Object.hasOwn(members, n)))
    throw new GraphError("invalid_bundle", "A bundle must contain exactly the five standard files.");
  if (Object.values(members).reduce((sum, b) => sum + b.byteLength, 0) > MAX_MEMBER_BYTES)
    throw new GraphError("size_limit", "Bundle files exceed the 20 MiB input limit. Use individual downloads.");
}
export function packArchive(members: Record<string, Uint8Array>) {
  validateArchiveMembers(members);
  // PNG is already compressed. STORE avoids unbounded compression work and keeps
  // member bytes unchanged; packing runs in the bounded rendering child.
  const zip = zipSync(Object.fromEntries(ARCHIVE_NAMES.map((n) => [n, members[n]])), {
    level: 0, mtime: new Date(1980, 0, 1),
  });
  if (zip.byteLength > MAX_ARCHIVE_BYTES)
    throw new GraphError("size_limit", "The bundle exceeds 10 MiB. Use individual downloads.");
  return zip;
}
