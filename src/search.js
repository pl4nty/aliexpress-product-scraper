import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

/**
 * Search AliExpress for products matching a query.
 *
 * @param {string} query - Search terms
 * @param {object} options
 * @param {number} [options.limit=20] - Maximum number of results to return
 * @param {object} [options.puppeteerOptions={}] - Extra Puppeteer launch options
 * @param {number} [options.timeout=60000] - Navigation timeout in ms
 * @returns {Promise<Array>} Array of product result objects
 */
const AliexpressSearch = async (
  query,
  { limit = 20, puppeteerOptions = {}, timeout = 60000 } = {}
) => {
  if (!query || !query.trim()) {
    throw new Error("Please provide a valid search query");
  }

  let browser;
  // Connect to a remote CDP browser when the env var is set; otherwise launch locally
  const browserWSEndpoint = process.env.PUPPETEER_BROWSERWS_ENDPOINT;

  try {
    browser = browserWSEndpoint
      ? await puppeteer.connect({ browserWSEndpoint })
      : await puppeteer.launch({
        headless: true,
        ...puppeteerOptions,
      });

    const page = await browser.newPage();
    const searchUrl = `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query.trim())}.html`;

    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout,
    });

    // Wait for search result cards to appear
    await page.waitForSelector("[class*='search-item-card']", { timeout: 15000 }).catch(() => {});

    const results = await page.evaluate((maxResults) => {
      const items = [];
      // AliExpress search result cards use various selectors depending on layout
      const cardSelectors = [
        "[class*='search-item-card']",
        "[class*='SearchItem']",
        "[class*='product-item']",
        "a[href*='/item/']",
      ];

      let cards = [];
      for (const sel of cardSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          cards = Array.from(found);
          break;
        }
      }

      for (const card of cards) {
        if (items.length >= maxResults) {
          break;
        }

        try {
          // Try to find the product link
          const link = card.tagName === "A" ? card : card.querySelector("a[href*='/item/']");
          if (!link) {
            continue;
          }

          const href = link.href || "";
          const idMatch = href.match(/\/item\/(\d+)\.html/);
          if (!idMatch) {
            continue;
          }

          const productId = idMatch[1];

          // Title
          const titleEl =
            card.querySelector("[class*='title']") ||
            card.querySelector("h3") ||
            card.querySelector("h1");
          const title = titleEl ? titleEl.textContent.trim() : null;

          // Price – prefer sale price
          const priceEl =
            card.querySelector("[class*='sale-price']") ||
            card.querySelector("[class*='price']");
          const price = priceEl ? priceEl.textContent.trim() : null;

          // Image
          const imgEl = card.querySelector("img");
          const image = imgEl
            ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || null)
            : null;

          // Star rating
          const ratingEl =
            card.querySelector("[class*='rating']") ||
            card.querySelector("[aria-label*='star']");
          const rating = ratingEl
            ? (ratingEl.getAttribute("aria-label") || ratingEl.textContent.trim() || null)
            : null;

          // Orders count
          const ordersEl = card.querySelector("[class*='sold']") || card.querySelector("[class*='order']");
          const orders = ordersEl ? ordersEl.textContent.trim() : null;

          items.push({
            productId,
            title,
            price,
            image,
            rating,
            orders,
            url: `https://www.aliexpress.com/item/${productId}.html`,
          });
        } catch {
          // Skip malformed cards
        }
      }

      return items;
    }, limit);

    // Only close the browser when we launched it ourselves
    if (!browserWSEndpoint) {
      await browser.close();
    }
    return results;
  } catch (error) {
    if (browser && !browserWSEndpoint) {
      await browser.close();
    }
    throw error;
  }
};

export default AliexpressSearch;
