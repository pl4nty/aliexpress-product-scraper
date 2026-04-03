import { test } from "node:test";
import assert from "node:assert/strict";

test("AliexpressProductScraper", async (t) => {
  let launchCalled = false;
  let connectCalled = false;
  let connectArg = null;
  let closeCalled = false;

  const mockPage = {
    on: () => {},
    goto: async () => {},
    evaluate: async () => ({ minimal: "data" }),
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

  const { default: AliexpressProductScraper } = await import(
    "../../src/aliexpressProductScraper.js"
  );

  await t.test("throws when no product id is given", async () => {
    await assert.rejects(() => AliexpressProductScraper(), {
      message: "Please provide a valid product id",
    });
  });

  await t.test(
    "launches a local browser when BROWSER_WS_ENDPOINT is not set",
    async () => {
      delete process.env.BROWSER_WS_ENDPOINT;
      launchCalled = false;
      connectCalled = false;
      closeCalled = false;

      await AliexpressProductScraper("12345");

      assert.equal(launchCalled, true);
      assert.equal(connectCalled, false);
      assert.equal(closeCalled, true, "should close the locally-launched browser");
    }
  );

  await t.test(
    "connects to remote browser when BROWSER_WS_ENDPOINT is set",
    async () => {
      process.env.BROWSER_WS_ENDPOINT = "ws://localhost:9222";
      launchCalled = false;
      connectCalled = false;
      closeCalled = false;

      await AliexpressProductScraper("12345");

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

      delete process.env.BROWSER_WS_ENDPOINT;
    }
  );
});
