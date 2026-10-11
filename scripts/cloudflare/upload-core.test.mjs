import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureAsset, sha256, md5, immutableCache, concurrent, assertPublicHeaders, retryVerification } from "./upload-core.mjs";
import redirect from "./redirect.mjs";
const data = Buffer.from("test PDF bytes");
const asset = {key: `bank/assets/sha256/${sha256(data)}.pdf`, sha256: sha256(data), md5: md5(data), bytes: data.length, contentType: "application/pdf"};
test("new object is fetched and verified after uploading", async () => {
  let uploaded;
  const store = {head: async () => null, put: async (_, value) => {uploaded = value;}, get: async () => uploaded};
  assert.equal(await ensureAsset(store, asset, () => data), "uploaded");
});
test("matching existing bytes are reused without writing", async () => {
  const store = {head: async () => ({...asset, cacheControl: immutableCache}), put: async () => assert.fail("must not write")};
  assert.equal(await ensureAsset(store, asset, () => data), "reused");
});
test("changed local bytes, corrupt immutable objects and corrupt uploads stop publishing", async () => {
  const store = {head: async () => null, put: async () => {}, get: async () => Buffer.from("corrupt")};
  await assert.rejects(ensureAsset(store, asset, () => Buffer.from("changed")), /Source changed/);
  await assert.rejects(ensureAsset({...store, head: async () => ({...asset, sha256: "bad"})}, asset, () => data), /Refusing/);
  await assert.rejects(ensureAsset(store, asset, () => data), /verification/);
});
test("permission failure is propagated, never treated as a missing object", async () => {
  const store = {head: async () => {throw new Error("403");}, put: async () => assert.fail("must not write")};
  await assert.rejects(ensureAsset(store, asset, () => data), /403/);
});
test("upload pool drains in-flight work and refuses success after any failed object", async () => {
  await assert.rejects(concurrent([1,2,3,4], async value => {if (value === 2) throw new Error("upload failed"); return value;}, 2), /upload failed/);
  assert.deepEqual(await concurrent([1,2,3], async value => value * 2, 2), [2,4,6]);
});
test("public verification requires CORS, ETag and correct headers", () => {
  const headers = {"content-length": String(asset.bytes), "content-type": asset.contentType,
    etag: `"${asset.md5}"`, "cache-control": immutableCache, "access-control-allow-origin": "https://mathsdock.co.uk"};
  assertPublicHeaders(new Response(null, {headers}), asset, "https://mathsdock.co.uk");
  delete headers["access-control-allow-origin"];
  assert.throws(() => assertPublicHeaders(new Response(null, {headers}), asset, "https://mathsdock.co.uk"), /CORS/);
});
test("domain redirects preserve question routes, search and fragment", async () => {
  const response = await redirect.fetch(new Request("https://www.mathsdock.com/?tool=question-bank&question=Q1#part"));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://mathsdock.co.uk/?tool=question-bank&question=Q1#part");
});

test("live verification waits through deployment propagation and succeeds only after the check passes", async () => {
  let clock = 0, attempts = 0, retries = 0;
  const remaining = [];
  const result = await retryVerification(async budget => {
    remaining.push(budget());
    if (++attempts < 3) throw new Error("HTTP 404 while propagating");
    return "verified";
  }, {timeoutMs: 20, intervalMs: 5, now: () => clock, sleep: async ms => {clock += ms;}, onRetry: () => {retries++;}});
  assert.equal(result, "verified");
  assert.equal(retries, 2);
  assert.deepEqual(remaining, [20, 15, 10]);
});

test("permanent live verification failures stop at the deadline and retain the error", async () => {
  let clock = 0, attempts = 0;
  await assert.rejects(retryVerification(async () => {attempts++; throw new Error("Catalogue mismatch");}, {
    timeoutMs: 10, intervalMs: 6, now: () => clock, sleep: async ms => {clock += ms;},
  }), /Catalogue mismatch/);
  assert.equal(clock, 10);
  assert.equal(attempts, 2);
});

test("already available sites do not sleep or retry", async () => {
  assert.equal(await retryVerification(async () => "ready", {sleep: async () => assert.fail("must not wait")}), "ready");
});
