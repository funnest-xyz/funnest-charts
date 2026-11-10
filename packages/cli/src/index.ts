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
} from './spec';
export { reactCode, renderHtml, renderPng, renderSvg, valueFormatter, type RenderOptions } from './render';
export { parseCsv, parseData, suggestCharts, type Suggestion } from './data';
export { messages, type CliLocale } from './i18n';
export { datafeedTemplate, type DatafeedTemplateKind } from './templates';
