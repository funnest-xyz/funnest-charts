/**
 * @funnest/charts-cli — chart specs for tools and AI agents.
 *
 * A JSON spec ({ type, data, x, y, … }) is validated, turned into JSON Schema, rendered to
 * SVG/PNG/HTML with the same React components apps use, or translated into React code.
 * The `funnest-charts` command and @funnest/charts-mcp are thin layers over these functions.
 */
export {
  CHARTS,
  CHART_TYPES,
  chartSchema,
  closest,
  exampleSpec,
  validateSpec,
  type ChartDef,
  type ChartSpec,
  type ChartType,
  type FieldDef,
  type PointSpec,
  type ReferenceLineSpec,
  type Row,
  type ValidationIssue,
} from './spec.js';
export { reactCode, renderHtml, renderPng, renderSvg, valueFormatter, type RenderOptions } from './render.js';
export { parseCsv, parseData, suggestCharts, type Suggestion } from './data.js';
export { messages, systemLocale, type CliLocale } from './i18n.js';
export { datafeedTemplate, type DatafeedTemplateKind } from './templates.js';
