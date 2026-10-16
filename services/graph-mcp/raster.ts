import { fork } from "node:child_process";
import { resolve } from "node:path";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { validateArchiveMembers } from "./archive";
export type Crop = { svg: string; widthCm: number; heightCm: number };
type WorkerResult = { png?: Uint8Array; svg?: string; zip?: Uint8Array; crop?: Crop };
export class RasterQueue {
  private active = false;
  private waiting: Array<() => void> = [];
  constructor(
    private workerFile = resolve("service-dist/raster-worker.js"),
    private fontRoot = resolve("assets/graph-fonts"),
    private timeoutMs = 15000,
  ) {}
  async render(
    svg: string,
    width: number,
    height: number,
    print = false,
    outlined = false,
    signal?: AbortSignal,
    artifactKind: "graph" | "ratio-table" | "value-graph" | "cuboids" | "number-line" | "venn" = "graph",
  ): Promise<{ png?: Uint8Array; svg?: string }> {
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > 32_000_000
    )
      throw new GraphError(
        "size_limit",
        "The print image exceeds 32 million pixels.",
      );
    return this.run({ svg, width, height, print, outlined, fontRoot: this.fontRoot, artifactKind }, signal);
  }
  async pack(members: Record<string, Uint8Array>, signal?: AbortSignal): Promise<Uint8Array> {
    validateArchiveMembers(members);
    const result = await this.run({ archive: members }, signal);
    if (!result.zip) throw new GraphError("render_failed", "No archive was generated.");
    return result.zip;
  }
  async crop(svg: string, signal?: AbortSignal): Promise<Crop> {
    const result = await this.run({ svg, measureCrop: true, fontRoot: this.fontRoot }, signal);
    if (!result.crop) throw new GraphError("render_failed", "No cropped artwork was generated.");
    return result.crop;
  }
  private async run(job: Record<string, unknown>, signal?: AbortSignal): Promise<WorkerResult> {
    if (this.waiting.length >= 3)
      throw new GraphError("busy", "The renderer is busy. Try again shortly.");
    if (this.active)
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        };
        const ready = () => {
          cleanup();
          resolve();
        };
        const abort = () => {
          this.waiting = this.waiting.filter((r) => r !== ready);
          cleanup();
          reject(
            new GraphError(
              "render_timeout",
              "The request was cancelled or waited too long.",
            ),
          );
        };
        const timer = setTimeout(abort, this.timeoutMs);
        this.waiting.push(ready);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
    this.active = true;
    try {
      if (signal?.aborted)
        throw new GraphError("render_timeout", "The request was cancelled.");
      return await new Promise((resolve, reject) => {
        const child = fork(this.workerFile, [], {
          serialization: "advanced",
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          execArgv: ["--max-old-space-size=128"],
        });
        let settled = false;
        const finish = (
          error?: Error,
          result?: WorkerResult,
        ) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          child.kill("SIGKILL");
          if (error) reject(error);
          else resolve(result!);
        };
        const abort = () =>
          finish(
            new GraphError(
              "render_timeout",
              "The render timed out or was cancelled.",
            ),
          );
        const timer = setTimeout(abort, this.timeoutMs);
        signal?.addEventListener("abort", abort, { once: true });
        child.once("error", () =>
          finish(
            new GraphError("render_failed", "The renderer could not start."),
          ),
        );
        child.once("exit", () =>
          finish(
            new GraphError(
              "render_failed",
              "The renderer stopped before producing output.",
            ),
          ),
        );
        child.once(
          "message",
          (message: WorkerResult & { error?: string; code?: string }) => {
            if (message.error)
              finish(new GraphError(message.code ?? "render_failed", message.error));
            else if (
              (message.zip?.byteLength ?? message.png?.byteLength ??
                Buffer.byteLength(message.svg ?? message.crop?.svg ?? "")) >
              10 * 1024 * 1024
            )
              finish(
                new GraphError(
                  "size_limit",
                  "The rendered file exceeds 10 MiB.",
                ),
              );
            else finish(undefined, message);
          },
        );
        child.send(job);
      });
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active = false;
    }
  }
}
