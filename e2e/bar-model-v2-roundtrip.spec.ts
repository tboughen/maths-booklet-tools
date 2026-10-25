import { test, expect } from "./release-fixtures";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as c from "../packages/bar-model-core/src/v2";
import {
  hash,
  parseFile,
  layout,
} from "../packages/bar-model-core/src/versioned";
import { receiveSvg } from "../services/graph-mcp/svg-consumer";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
test("v2 bar MCP resource survives secondary-label and caption browser edits and exact MCP revision", async ({
  page,
}, info) => {
  const reserve = createServer();
  await new Promise<void>((r) => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((r) => reserve.close(() => r()));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["service-dist/cli.js"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      BIND_HOST: "127.0.0.1",
      GRAPH_PUBLIC_URL: origin,
      GRAPH_EDITOR_URL: "https://mathsdock.co.uk/",
      DOWNLOAD_SIGNING_KEY: "bar-roundtrip-synthetic-test-key-only",
    },
  });
  const started = Date.now(),
    progress: { stage: string; elapsedMs: number }[] = [];
  async function mark(stage: string) {
    progress.push({ stage, elapsedMs: Date.now() - started });
    await writeFile(info.outputPath("progress.json"), JSON.stringify(progress));
  }
  const client = new Client({ name: "bar-browser-roundtrip", version: "1" });
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(origin + "/healthz")).ok;
          } catch {
            return false;
          }
        },
        { timeout: 10000 },
      )
      .toBe(true);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(origin + "/mcp")),
    );
    type Result = {
      envelope: c.Envelope;
      contentHash: string;
      editorUrl: string;
      downloads: Record<string, { url: string }>;
      physicalSizeCm: { width: number; height: number };
      printRaster: { width: number; height: number };
    };
    await mark("connected");
    const reply = await client.callTool({
      name: "create_bar_model",
      arguments: {
        envelope: (() => {
          const seed = c.fresh("equal-sections", 5);
          seed.document.bars[0].parts[3].labels.inside = c.label(
            "18",
            "hidden",
          );
          return seed;
        })(),
      },
    });
    expect(reply.isError).not.toBe(true);
    const made = reply.structuredContent as Result,
      link = new URL(made.editorUrl);
    await mark("created");
    await page.goto(`/?${link.searchParams}${link.hash}`);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Open bar model", exact: true })
      .click();
    await mark("opened");
    await page
      .getByLabel("Label position", { exact: true })
      .selectOption("above");
    await page
      .getByRole("button", { name: "Edit above label", exact: true })
      .first()
      .click();
    await page.getByLabel("Saved label", { exact: true }).fill("1/4");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page
      .getByRole("button", { name: "Add calculation line", exact: true })
      .click();
    await page.getByLabel("Saved label", { exact: true }).fill("4/5 × 45 = 36");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("button", { name: "File", exact: true }).click();
    const event = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: "Save editable file", exact: true })
      .click();
    const file = await event,
      path = info.outputPath("browser-edited-source.json");
    await file.saveAs(path);
    const saved = c.validate(parseFile(await readFile(path, "utf8")));
    expect(saved.document.bars[0].parts[0].labels.above?.text).toBe("1/4");
    expect(saved.document.bars[0].parts[3].labels.inside).toEqual(
      c.label("18", "hidden"),
    );
    await mark("saved");
    const revised =
      await test.step("revise exact browser-saved source", async () =>
        client.callTool({
          name: "revise_bar_model",
          arguments: {
            envelope: saved,
            baseHash: await hash(saved),
            operations: [
              { op: "set_fill", barId: "b1", partIds: ["b1p1"], fill: "blue" },
            ],
          },
        }));
    expect(revised.isError).not.toBe(true);
    const result = revised.structuredContent as Result;
    expect(result.envelope.document.annotations).toEqual(
      saved.document.annotations,
    );
    expect(result.envelope.document.bars[0].parts[3]).toEqual(
      saved.document.bars[0].parts[3],
    );
    const geometry = layout(saved);
    expect(result.physicalSizeCm).toEqual({
      width: geometry.width / 10,
      height: geometry.height / 10,
    });
    expect(result.envelope.document.captions).toEqual(saved.document.captions);
    await mark("revised");
    const svg =
      await test.step("receive and verify original SVG chunks", async () =>
        receiveSvg(
          async (args) => {
            const r = await client.callTool({
              name: "get_diagram_svg",
              arguments: args,
            });
            expect(r.isError).not.toBe(true);
            return r.structuredContent;
          },
          {
            kind: "bar-model",
            envelope: result.envelope,
            maxChunkBytes: 16384,
          },
          {
            expectedSourceContentHash: result.contentHash,
            expectedPhysicalSizeCm: result.physicalSizeCm,
          },
        ));
    await writeFile(info.outputPath("original-mcp.svg"), svg.body);
    await mark("original-svg");
    const proofs = [];
    for (const format of ["svg", "png", "json"]) {
      const response = await fetch(result.downloads[format].url);
      expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(info.outputPath(`revised.${format}`), bytes);
      if (format === "svg") expect(bytes).toEqual(svg.body);
      if (format === "png")
        verifyPrintBytes(
          bytes,
          result.printRaster.width,
          result.printRaster.height,
        );
      if (format === "json")
        expect(JSON.parse(bytes.toString("utf8"))).toEqual(result.envelope);
      proofs.push({
        format,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    await writeFile(
      info.outputPath("roundtrip-proof.json"),
      JSON.stringify(
        {
          status: "passed",
          sourceHash: result.contentHash,
          physicalSizeCm: result.physicalSizeCm,
          proofs,
          provenance:
            "Local SDK/HTTP plus real browser, exact saved file and original SVG. Not actual ChatGPT or deployed-service acceptance.",
        },
        null,
        2,
      ),
    );
  } finally {
    await mark("closing");
    await client.close();
    child.kill();
    await mark("closed");
  }
});
