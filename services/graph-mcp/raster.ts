import { fork } from "node:child_process";
import { resolve } from "node:path";
import { GraphError } from "../../packages/graph-core/src/interchange";
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
          result?: { png?: Uint8Array; svg?: string },
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
          (message: { png?: Uint8Array; svg?: string; error?: string }) => {
            if (message.error)
              finish(new GraphError("render_failed", message.error));
            else if (
              (message.png?.byteLength ??
                Buffer.byteLength(message.svg ?? "")) >
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
        child.send({
          svg,
          width,
          height,
          print,
          outlined,
          fontRoot: this.fontRoot,
        });
      });
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active = false;
    }
  }
}
