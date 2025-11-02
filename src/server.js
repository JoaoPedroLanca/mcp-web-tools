import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetch } from "undici";
import { JSDOM } from "jsdom";
import Readability from "@mozilla/readability";

const server = new McpServer({
    name: "mcp-web-tools-server",
    version: "0.1.0",
});

const SEARCH_RESULTS_LIMIT_DEFAULT = 10;
const MAX_FETCH_BYTES = 1024 * 1024 * 16;

async function ddgSearch(query, limit) {
    const params = new URLSearchParams({ q: query, kl: "us-en" });
    const res = await fetch(`https://duckduckgo.com/html/?${params.toString()}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MCP-Web-Tools/0.1; +https://example.com)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const results = [];
    const nodes = doc.querySelectorAll(".result__title a.result__a");
    for (const a of nodes) {
        const title = a.textContent?.trim() || "";
        let href = a.getAttribute("href") || "";
        if (!href) continue;
        let url = href;
        try {
            if (href.startsWith("/l/?") || href.includes("duckduckgo.com/l/?")) {
                const full = href.startsWith("http") ? href : `https://duckduckgo.com${href}`;
                const u = new URL(full);
                const target = u.searchParams.get("uddg");
                if (target) url = decodeURIComponent(target);
            } else if (href.startsWith("//")) {
                url = `https:${href}`;
            } else if (href.startsWith("/")) {
                url = `https://duckduckgo.com${href}`;
            }
        } catch { }
        if (!url) continue;
        results.push({ title, url });
        if (results.length >= limit) break;
    }
    return results;
}

async function serpApiSearch(query, limit) {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return null;
    const params = new URLSearchParams({
        engine: "google",
        q: query,
        num: String(Math.min(limit, 10)),
        api_key: apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
    const data = await res.json();
    const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
    return organic.slice(0, limit).map((r) => ({ title: r.title || "", url: r.link || "" }));
}

server.tool(
    "search_web",
    {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
    },
    async (input) => {
        const limit = input.limit ?? SEARCH_RESULTS_LIMIT_DEFAULT;
        let results = null;
        try {
            results = await serpApiSearch(input.query, limit);
        } catch (e) {

        }
        if (!results) {
            results = await ddgSearch(input.query, limit);
        }
        const text = results
            .map((r, i) => `${i + 1}. ${r.title}\n${r.url}`)
            .join("\n\n");
        return {
            content: [{ type: "text", text: text || "No results" }],
        };
    }
);

server.tool(
    "fetch_url",
    {
        url: z.string().url(),
        maxBytes: z.number().int().min(1024).max(16 * 1024 * 1024).optional(),
    },
    async (input) => {
        const maxBytes = Math.min(input.maxBytes ?? MAX_FETCH_BYTES, 16 * 1024 * 1024);
        const res = await fetch(input.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; MCP-Web-Tools/0.1; +https://example.com)",
                Accept: "*/*",
            },
        });
        const contentType = res.headers.get("content-type") || "";

        const reader = res.body.getReader();
        let received = 0;
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > maxBytes) {
                chunks.push(value.subarray(0, value.byteLength - (received - maxBytes)));
                break;
            }
            chunks.push(value);
        }
        const body = Buffer.concat(chunks.map((u) => Buffer.from(u))).toString("utf8");
        const summary = `contentType: ${contentType}\nbytes: ${Math.min(received, maxBytes)}`;
        return {
            content: [
                { type: "text", text: summary },
                { type: "text", text: body },
            ],
        };
    }
);

server.tool(
    "extract_readable",
    { url: z.string().url() },
    async (input) => {
        const res = await fetch(input.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; MCP-Web-Tools/0.1; +https://example.com)",
            },
        });
        const html = await res.text();
        const dom = new JSDOM(html, { url: input.url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) {
            return { content: [{ type: "text", text: "No readable content found." }] };
        }
        const textBlocks = [];
        if (article.title) textBlocks.push(`# ${article.title}`);
        if (article.byline) textBlocks.push(`by ${article.byline}`);
        if (article.excerpt) textBlocks.push(article.excerpt);
        if (article.textContent) textBlocks.push(article.textContent);
        return { content: [{ type: "text", text: textBlocks.join("\n\n") }] };
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);