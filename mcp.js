#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import AliexpressProductScraper from "./src/aliexpressProductScraper.js";
import AliexpressSearch from "./src/search.js";

const server = new McpServer({
  name: "aliexpress-product-scraper",
  version: "4.0.0",
});

server.tool(
  "scrape_product",
  "Scrape AliExpress product details by product ID",
  {
    productId: z.string().describe("The AliExpress product ID"),
    reviewsCount: z.number().int().min(0).default(20).describe("Number of reviews to fetch"),
    filterReviewsBy: z
      .union([z.literal("all"), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .default("all")
      .describe("Filter reviews by star rating (1-5) or 'all'"),
    timeout: z.number().int().min(0).default(60000).describe("Page navigation timeout in ms"),
  },
  async ({ productId, reviewsCount, filterReviewsBy, timeout }) => {
    const data = await AliexpressProductScraper(productId, {
      reviewsCount,
      filterReviewsBy,
      timeout,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "search_products",
  "Search AliExpress for products matching a query",
  {
    query: z.string().describe("Search terms"),
    limit: z.number().int().min(1).default(20).describe("Maximum number of results to return"),
    timeout: z.number().int().min(0).default(60000).describe("Page navigation timeout in ms"),
  },
  async ({ query, limit, timeout }) => {
    const results = await AliexpressSearch(query, { limit, timeout });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
