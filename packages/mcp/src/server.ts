/**
 * @funnest/charts-mcp — stdio MCP server.
 *
 *   claude mcp add funnest-charts -- npx -y @funnest/charts-mcp
 *
 * Tools: list_charts, get_chart_schema, validate_spec, render_chart, suggest_chart,
 * get_datafeed_template. Data must be passed inline (no URL fetching), so the server never
 * reaches into private networks on an agent's behalf.
 */
import {
  CHARTS,
  CHART_TYPES,
  chartSchema,
  datafeedTemplate,
  exampleSpec,
  reactCode,
  renderPng,
  renderSvg,
  suggestCharts,
  validateSpec,
  type ChartSpec,
  type CliLocale,
} from '@funnest/charts-cli';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'funnest-charts', version: '0.6.13' });

const locale = z.enum(['ko', 'en']).optional().describe('Message language (default ko)');
const chartType = z.enum(CHART_TYPES as [string, ...string[]]);
const text = (value: unknown) => ({ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) });

server.registerTool(
  'list_charts',
  {
    title: 'List charts',
    description:
      'List Funnest Charts chart types (line, area, bar, candlestick, donut, treemap, percentage-bar, sparkline) with what each is for and the React component it maps to. For a full trading chart (candles, indicators, drawing tools) use <FnChart /> with a Datafeed — see get_datafeed_template.',
    inputSchema: { locale },
  },
  async ({ locale: l = 'ko' }) => ({
    content: [text(CHART_TYPES.map((t) => ({ type: t, description: CHARTS[t][l as CliLocale], component: CHARTS[t].component })))],
  }),
);

server.registerTool(
  'get_chart_schema',
  {
    title: 'Get chart schema',
    description: 'JSON Schema and an example spec for one chart type. Read this before writing a spec.',
    inputSchema: { type: chartType, locale },
  },
  async ({ type, locale: l = 'ko' }) => ({
    content: [text({ schema: chartSchema(type as ChartSpec['type'], l as CliLocale), example: exampleSpec(type as ChartSpec['type']) })],
  }),
);

server.registerTool(
  'validate_spec',
  {
    title: 'Validate spec',
    description: 'Check a chart spec. Returns problems with "did you mean" hints for misspelled fields and missing data columns.',
    inputSchema: { spec: z.record(z.string(), z.unknown()).describe('Chart spec object'), locale },
  },
  async ({ spec, locale: l = 'ko' }) => {
    const issues = validateSpec(spec, l as CliLocale);
    return { content: [text(issues.length ? { valid: false, issues } : { valid: true })] };
  },
);

server.registerTool(
  'render_chart',
  {
    title: 'Render chart',
    description:
      'Render a chart spec. Returns a PNG image (to look at), the SVG markup, and React code using @funnest/charts-react that draws the same chart in an app. Pass data inline.',
    inputSchema: {
      spec: z.record(z.string(), z.unknown()).describe('Chart spec object (validate_spec first if unsure)'),
      theme: z.enum(['light', 'dark']).optional(),
      locale,
    },
  },
  async ({ spec, theme, locale: l = 'ko' }) => {
    const issues = validateSpec(spec, l as CliLocale);
    if (issues.length) return { isError: true, content: [text({ valid: false, issues })] };
    const s = { ...(spec as unknown as ChartSpec), ...(l ? { locale: l as CliLocale } : {}) };
    const options = theme ? { theme } : {};
    const svg = renderSvg(s, options);
    const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [];
    try {
      const png = await renderPng(s, { ...options, scale: 2 });
      content.push({ type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' });
    } catch {
      content.push(text('(PNG unavailable: install @resvg/resvg-js. SVG and React code follow.)'));
    }
    content.push(text(`SVG:\n${svg}`), text(`React:\n${reactCode(s)}`));
    return { content };
  },
);

server.registerTool(
  'suggest_chart',
  {
    title: 'Suggest chart',
    description: 'Given data rows, propose fitting charts (ready-to-render specs with reasons).',
    inputSchema: { data: z.array(z.record(z.string(), z.unknown())).min(1).describe('Data rows'), locale },
  },
  async ({ data, locale: l = 'ko' }) => ({
    content: [
      text(
        suggestCharts(data).map((s) => ({
          reason: s.reason[l as CliLocale],
          // Keep responses small: the agent already has the data.
          spec: { ...s.spec, data: `<${data.length} rows>` },
        })),
      ),
    ],
  }),
);

server.registerTool(
  'get_datafeed_template',
  {
    title: 'Datafeed template',
    description:
      'TypeScript starter for a Datafeed — the interface <FnChart /> (the full trading chart) reads candles and realtime updates from. Use it to connect an exchange/broker API in the app. The library itself contains no exchange connections.',
    inputSchema: { kind: z.enum(['rest-websocket', 'polling', 'static']).optional().describe('rest-websocket (default), polling, or static data') },
  },
  async ({ kind }) => ({ content: [text(datafeedTemplate(kind))] }),
);

await server.connect(new StdioServerTransport());
