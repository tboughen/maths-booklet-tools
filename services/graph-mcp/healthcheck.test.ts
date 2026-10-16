// @vitest-environment node
import { expect, it } from "vitest";
import { graphService } from "./server";
import { checkHealth, healthOrigin } from "./healthcheck";
it("probes the real loopback listener using the configured public Host and rejects the wrong Host", async () => {
  const server = graphService({
    publicUrl: "https://configured-service.example",
    editorUrl: "https://mathsdock.co.uk",
    keys: { test: "synthetic-health-test-key-not-for-production" },
    activeKey: "test",
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const port = (server.address() as { port: number }).port;
    expect(await checkHealth("https://configured-service.example", port)).toBe(
      true,
    );
    expect(await checkHealth("https://wrong-service.example", port)).toBe(
      false,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
it("matches CLI public-origin fallback without disclosing keys", () => {
  expect(
    healthOrigin({
      GRAPH_PUBLIC_URL: "https://explicit.example",
      RENDER_EXTERNAL_URL: "https://render.example",
    }),
  ).toBe("https://explicit.example");
  expect(
    healthOrigin({
      GRAPH_PUBLIC_URL: "",
      RENDER_EXTERNAL_URL: "https://render.example",
    }),
  ).toBe("https://render.example");
  expect(healthOrigin({})).toBe("http://127.0.0.1:8787");
});
