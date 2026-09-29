import assert from "node:assert/strict";
import test from "node:test";
import { cacheKey, clearHostCache, getCachedCount } from "./cache.ts";

test("keys cached values by host and arguments", () => {
  assert.notEqual(cacheKey("host-a", "all"), cacheKey("host-b", "all"));
  assert.notEqual(cacheKey("host-a", "all"), cacheKey("host-a", "active"));
});

test("reuses a fresh value and clears one host", async () => {
  let loads = 0;
  const load = async () => {
    loads += 1;
    return loads;
  };

  assert.equal(await getCachedCount("host-a", "all", 0, load), 1);
  assert.equal(await getCachedCount("host-a", "all", 1, load), 1);
  clearHostCache("host-a");
  assert.equal(await getCachedCount("host-a", "all", 2, load), 2);
});

test("disconnect invalidation cannot be undone by a pending response", async () => {
  const { promise, resolve } = Promise.withResolvers();
  const pending = getCachedCount("host-race", "all", 0, () => promise);
  clearHostCache("host-race");
  resolve(12);
  assert.equal(await pending, 12);
  assert.equal(await getCachedCount("host-race", "all", 1, async () => 42), 42);
});
