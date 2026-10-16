import { isUtf8 } from "node:buffer";
import { svgDeliveryOutput, svgSha256, type SvgDeliveryInput, type SvgDelivery } from "./svg-delivery";

/** Reference consumer: only the supplied MCP call can perform I/O; no URL fetch. */
export async function receiveSvg(
  read: (input: SvgDeliveryInput) => Promise<unknown>,
  source: Omit<SvgDeliveryInput, "offsetBytes" | "expectedSvgSha256">,
  options: { maxChunks?: number; expectedSourceContentHash?: string; expectedPhysicalSizeCm?: { width: number; height: number } } = {},
) {
  const maximum = options.maxChunks ?? 256;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 256) throw Error("maxChunks must be 1..256.");
  const buffers: Buffer[] = [];
  let offset = 0, first: SvgDelivery | undefined, identity = "";
  for (let count = 0; count < maximum; count++) {
    const part = svgDeliveryOutput.parse(await read({ ...source, offsetBytes: offset,
      ...(first ? { expectedSvgSha256: first.svgSha256 } : {}) }));
    const stable = JSON.stringify({ kind: part.kind, filename: part.filename, encoding: part.encoding,
      mimeType: part.mimeType, rendererVersion: part.rendererVersion, sourceContentHash: part.sourceContentHash,
      physicalSizeCm: part.physicalSizeCm, outputView: part.outputView, totalBytes: part.totalBytes, svgSha256: part.svgSha256 });
    if (!first) {
      first = part; identity = stable;
      if (part.kind !== source.kind || part.rendererVersion !== source.envelope.rendererVersion ||
          part.outputView !== (source.kind === "venn" ? source.outputView ?? "pupil" : undefined) ||
          (options.expectedSourceContentHash !== undefined && part.sourceContentHash !== options.expectedSourceContentHash) ||
          (options.expectedPhysicalSizeCm !== undefined &&
            (part.physicalSizeCm.width !== options.expectedPhysicalSizeCm.width || part.physicalSizeCm.height !== options.expectedPhysicalSizeCm.height)))
        throw Error("SVG metadata does not match the requested resource.");
    } else if (stable !== identity) throw Error("SVG identity changed between chunks.");
    const bytes = Buffer.from(part.svgChunk, "utf8");
    if (part.offsetBytes !== offset || bytes.length !== part.chunkBytes || !isUtf8(bytes) ||
        svgSha256(bytes) !== part.chunkSha256 || bytes.length > (source.maxChunkBytes ?? 49152))
      throw Error("SVG chunk offset, bytes or checksum failed.");
    const end = offset + bytes.length;
    if (end > part.totalBytes || part.complete !== (end === part.totalBytes) ||
        part.nextOffsetBytes !== (part.complete ? null : end)) throw Error("SVG completion or continuation failed.");
    buffers.push(bytes); offset = end;
    if (part.complete) {
      const body = Buffer.concat(buffers);
      if (body.length !== first.totalBytes || svgSha256(body) !== first.svgSha256 || !/<svg(?:\s|>)/.test(body.toString("utf8")))
        throw Error("Complete SVG byte count, checksum or root failed.");
      return { body, chunks: count + 1, svgSha256: first.svgSha256, sourceContentHash: first.sourceContentHash,
        physicalSizeCm: first.physicalSizeCm, ...(first.outputView ? { outputView: first.outputView } : {}) };
    }
  }
  throw Error("SVG delivery exceeded the bounded chunk count; no complete file is available.");
}
