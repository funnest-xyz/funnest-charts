# @funnest/charts-mcp

MCP server for AI tools (Claude Code, Cursor and others): chart schemas, spec validation, rendering with React code and Datafeed templates.

Claude Code:

```bash
claude mcp add funnest-charts -- npx -y @funnest/charts-mcp
```

Claude Desktop, Cursor:

```json
{ "mcpServers": { "funnest-charts": { "command": "npx", "args": ["-y", "@funnest/charts-mcp"] } } }
```

Tools: `list_charts`, `get_chart_schema`, `validate_spec`, `render_chart` (PNG + SVG + React code), `suggest_chart`, `get_datafeed_template`.
Data goes to the tools inline; the server never fetches from outside addresses.
Messages follow the machine's language (English, or Korean on a Korean system); any tool takes `locale: 'en' | 'ko'`.

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
