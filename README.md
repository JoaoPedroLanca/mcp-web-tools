## MCP Web Tools Server (Node.js)

⭐ If you find this useful, please consider giving it a star!

MCP (Model Context Protocol) server for LM Studio that provides tools for internet connectivity:

- search_web: searches the web and returns titles and URLs
- fetch_url: performs HTTP GET and returns content-type and body (limited)
- extract_readable: extracts the main readable content from a page

### Requirements

- Node.js 18+

### Installation

```bash
npm install
```

### Execution (stdio mode)

```bash
npm start
```

The server uses stdio (required for integration with LM Studio via MCP).

### Environment variables (optional)

- `SERPAPI_KEY`: if provided, the `search_web` tool will use SerpAPI (Google). Otherwise, leave the field empty to use DuckDuckGo (HTML) without a key.

### LM Studio Configuration

Add a custom MCP server pointing to this project's command. In LM Studio, go to Program → Install → Edit mcp.json, and paste the json below:


```json
{
  "mcpServers": {
    "mcp-web-tools-server": {
      "command": "npm",
      "args": [
        "run",
        "start",
        "--silent"
      ],
      "cwd": "C:/mcp-web-tools",
      "env": {
        "SERPAPI_KEY": ""
      }
    }
  }
}
```

In "cwd" put the project Path

### Available tools

- `search_web`:
  - input: `{ "query": string, "limit?": number (1..10) }`
  - output: text with numbered list (title and URL)

- `fetch_url`:
  - input: `{ "url": string, "maxBytes?": number (up to 8MB) }`
  - output: two text blocks: metadata (contentType/bytes) and truncated body

- `extract_readable`:
  - input: `{ "url": string }`
  - output: text with title, byline, summary and main content

### Getting Started

Clone the repository:

```bash
git clone https://github.com/JoaoPedroLanca/mcp-web-tools.git
cd mcp-web-tools
npm install
npm start
```

[![Download ZIP](https://img.shields.io/badge/Download-ZIP-blue)](https://github.com/JoaoPedroLanca/mcp-web-tools/archive/refs/heads/main.zip)

### Notes

- Very large responses are truncated (16MB by default) to avoid exceeding client limits.
- `search_web` without a key uses DuckDuckGo HTML; results may vary and are subject to site changes.