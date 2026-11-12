export type CliLocale = 'ko' | 'en';

const MESSAGES = {
  ko: {
    required: (f: string) => `${f}: 필수 항목이에요.`,
    unknownField: (f: string, hint: string | null) => `${f}: 알 수 없는 항목이에요.${hint ? ` 혹시 "${hint}"인가요?` : ''}`,
    wrongType: (f: string, want: string) => `${f}: ${want} 값이어야 해요.`,
    notOneOf: (f: string, list: string) => `${f}: ${list} 중 하나여야 해요.`,
    unknownType: (t: string, hint: string | null) => `type: "${t}"는 없는 차트예요.${hint ? ` 혹시 "${hint}"인가요?` : ''} (funnest-charts list)`,
    noColumn: (f: string, col: string, cols: string, hint: string | null) =>
      `${f}: 데이터에 "${col}" 열이 없어요.${hint ? ` 혹시 "${hint}"인가요?` : ''} 있는 열: ${cols}`,
    notNumeric: (f: string, col: string) => `${f}: "${col}" 열에 숫자가 아닌 값이 있어요.`,
    emptyData: 'data: 데이터가 비어 있어요.',
    valid: '스펙에 문제가 없어요.',
    invalid: (n: number) => `오류 ${n}개`,
    wrote: (p: string) => `저장했어요: ${p}`,
    usage: `funnest-charts — Funnest Charts 명령줄 도구

사용법: funnest-charts <명령> [옵션]

명령:
  list                          차트 목록
  info <type>                   항목, 예시, React 코드
  example <type> [--out f]      시작용 스펙
  schema <type> [--out f]       JSON 스키마
  validate <spec.json>          스펙 검사 (오류가 있으면 1로 끝나요)
  render <spec.json> --out f    SVG · PNG · HTML로 그리기 (--theme light|dark, --scale 2)
  suggest <data.csv|json>       데이터에 맞는 차트 추천 (--out-dir charts)
  init <dir> [--type line]      시작 폴더 만들기 (spec.json, Chart.tsx)

모든 명령에 --locale ko|en 을 붙일 수 있어요.`,
    unknownCommand: (c: string) => `알 수 없는 명령이에요: ${c}`,
    needArg: (what: string) => `${what}이(가) 필요해요.`,
    pngMissing: 'PNG로 그리려면 @resvg/resvg-js가 필요해요: npm i @resvg/resvg-js',
    suggested: (n: number) => `추천 차트 ${n}개`,
    initDone: (dir: string) => `${dir} 폴더를 만들었어요. spec.json을 고치고 funnest-charts render spec.json --out chart.svg 로 그려보세요.`,
  },
  en: {
    required: (f: string) => `${f}: required.`,
    unknownField: (f: string, hint: string | null) => `${f}: unknown field.${hint ? ` Did you mean "${hint}"?` : ''}`,
    wrongType: (f: string, want: string) => `${f}: must be ${want}.`,
    notOneOf: (f: string, list: string) => `${f}: must be one of ${list}.`,
    unknownType: (t: string, hint: string | null) => `type: no chart "${t}".${hint ? ` Did you mean "${hint}"?` : ''} (funnest-charts list)`,
    noColumn: (f: string, col: string, cols: string, hint: string | null) =>
      `${f}: no column "${col}" in data.${hint ? ` Did you mean "${hint}"?` : ''} Columns: ${cols}`,
    notNumeric: (f: string, col: string) => `${f}: column "${col}" has non-numeric values.`,
    emptyData: 'data: is empty.',
    valid: 'Spec is valid.',
    invalid: (n: number) => `${n} error(s)`,
    wrote: (p: string) => `Wrote ${p}`,
    usage: `funnest-charts — Funnest Charts command line

Usage: funnest-charts <command> [options]

Commands:
  list                          List charts
  info <type>                   Fields, example, React code
  example <type> [--out f]      Starter spec
  schema <type> [--out f]       JSON Schema
  validate <spec.json>          Check a spec (exits 1 on errors)
  render <spec.json> --out f    Render to SVG, PNG or HTML (--theme light|dark, --scale 2)
  suggest <data.csv|json>       Suggest charts for your data (--out-dir charts)
  init <dir> [--type line]      Create a starter folder (spec.json, Chart.tsx)

Every command accepts --locale ko|en.`,
    unknownCommand: (c: string) => `Unknown command: ${c}`,
    needArg: (what: string) => `Missing ${what}.`,
    pngMissing: 'PNG output needs @resvg/resvg-js: npm i @resvg/resvg-js',
    suggested: (n: number) => `${n} suggestion(s)`,
    initDone: (dir: string) => `Created ${dir}. Edit spec.json, then run funnest-charts render spec.json --out chart.svg`,
  },
} as const;

export const messages = (locale: CliLocale = 'ko') => MESSAGES[locale];

/** The machine's language: Korean when the system says so (LC_ALL / LC_MESSAGES / LANG, then Intl), else English. */
export function systemLocale(): CliLocale {
  const env = typeof process !== 'undefined' ? process.env : {};
  const tag = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '';
  return tag.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}
