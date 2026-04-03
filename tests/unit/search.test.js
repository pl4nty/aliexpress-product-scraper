import { test } from "node:test";
import assert from "node:assert/strict";

test("AliexpressSearch", async (t) => {
  let launchCalled = false;
  let connectCalled = false;
  let connectArg = null;
  let closeCalled = false;

  const mockPage = {
    goto: async () => {},
    waitForSelector: async () => {},
    evaluate: async () => [],
  };

  const mockBrowser = {
    newPage: async () => mockPage,
    close: async () => {
      closeCalled = true;
    },
  };

  t.mock.module("puppeteer-extra-plugin-stealth", {
    defaultExport: () => ({}),
  });

  t.mock.module("puppeteer-extra", {
    defaultExport: {
      use: () => {},
      launch: async () => {
        launchCalled = true;
        return mockBrowser;
      },
      connect: async (opts) => {
        connectCalled = true;
        connectArg = opts;
        return mockBrowser;
      },
    },
  });

  const { default: AliexpressSearch } = await import("../../src/search.js");

  await t.test("throws when query is empty", async () => {
    await assert.rejects(() => AliexpressSearch(""), {
      message: "Please provide a valid search query",
    });
  });

  await t.test(
    "launches a local browser when BROWSER_WS_ENDPOINT is not set",
    async () => {
      delete process.env.BROWSER_WS_ENDPOINT;
      launchCalled = false;
      connectCalled = false;
      closeCalled = false;

      const results = await AliexpressSearch("keyboard");

      assert.equal(launchCalled, true);
      assert.equal(connectCalled, false);
      assert.equal(closeCalled, true, "should close the locally-launched browser");
      assert.deepStrictEqual(results, []);
    }
  );

  await t.test(
    "connects to remote browser when BROWSER_WS_ENDPOINT is set",
    async () => {
      process.env.BROWSER_WS_ENDPOINT = "ws://localhost:9222";
      launchCalled = false;
      connectCalled = false;
      closeCalled = false;

      const results = await AliexpressSearch("keyboard");

      assert.equal(launchCalled, false);
      assert.equal(connectCalled, true);
      assert.deepStrictEqual(connectArg, {
        browserWSEndpoint: "ws://localhost:9222",
      });
      assert.equal(
        closeCalled,
        false,
        "should not close a remotely-connected browser"
      );
      assert.deepStrictEqual(results, []);

      delete process.env.BROWSER_WS_ENDPOINT;
    }
  );

  await t.test("returns an array of results", async () => {
    const results = await AliexpressSearch("laptop");

    assert.ok(Array.isArray(results));
  });
});
