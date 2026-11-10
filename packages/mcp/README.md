# @funnest/charts-mcp

AI 도구(Claude Code, Cursor 등)용 MCP 서버

MCP server for AI tools: chart schemas, spec validation, rendering with React code, Datafeed templates.

Claude Code:

```bash
claude mcp add funnest-charts -- npx -y @funnest/charts-mcp
```

Claude Desktop, Cursor:

```json
{ "mcpServers": { "funnest-charts": { "command": "npx", "args": ["-y", "@funnest/charts-mcp"] } } }
```

도구: `list_charts`, `get_chart_schema`, `validate_spec`, `render_chart`(PNG + SVG + React 코드), `suggest_chart`, `get_datafeed_template`.
데이터는 도구에 직접 넘겨요. 서버가 외부 주소에서 데이터를 가져오지 않아요.

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/charts
- 라이선스: Apache-2.0
