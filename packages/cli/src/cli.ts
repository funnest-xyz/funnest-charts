import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { parseData, suggestCharts } from './data';
import { messages, type CliLocale } from './i18n';
import { reactCode, renderHtml, renderPng, renderSvg, type RenderOptions } from './render';
import { CHARTS, CHART_TYPES, chartSchema, closest, exampleSpec, validateSpec, type ChartSpec, type ChartType } from './spec';

interface Args {
  _: string[];
  flags: Record<string, string | true>;
}

/** `--key value`, `--key=value`, `--flag`; flags may appear anywhere. */
function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2) as [string, string | undefined];
      if (v !== undefined) out.flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) out.flags[k] = argv[++i]!;
      else out.flags[k] = true;
    } else out._.push(a);
  }
  return out;
}

const print = (s: string) => process.stdout.write(`${s}\n`);
const fail = (s: string): never => {
  process.stderr.write(`${s}\n`);
  process.exit(1);
};

async function write(path: string, data: string | Uint8Array, locale: CliLocale) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, data);
  print(messages(locale).wrote(path));
}

/** Read a spec file; `data` may be a path to a .csv/.json next to it. */
async function loadSpec(path: string): Promise<ChartSpec & { data: unknown }> {
  const spec = JSON.parse(await readFile(path, 'utf8')) as ChartSpec & { data: unknown };
  if (typeof spec.data === 'string') {
    const file = resolve(dirname(path), spec.data);
    spec.data = parseData(await readFile(file, 'utf8'), file);
  }
  return spec;
}

function chartType(name: string | undefined, locale: CliLocale): ChartType {
  const t = messages(locale);
  if (!name) fail(t.needArg('<type>'));
  if (!(name! in CHARTS)) fail(t.unknownType(name!, closest(name!, CHART_TYPES)));
  return name as ChartType;
}

async function main() {
  const { _: [command, ...rest], flags } = parseArgs(process.argv.slice(2));
  const locale: CliLocale = flags.locale === 'en' ? 'en' : 'ko';
  const t = messages(locale);
  const json = (v: unknown) => JSON.stringify(v, null, 2);

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
      print(t.usage);
      return;

    case 'list':
      for (const type of CHART_TYPES) print(`${type.padEnd(16)}${CHARTS[type][locale]}`);
      return;

    case 'info': {
      const type = chartType(rest[0], locale);
      const def = CHARTS[type];
      print(`${type} — ${def[locale]}  (<${def.component} />)\n`);
      for (const [name, f] of Object.entries(def.fields)) {
        const meta = [f.required ? (locale === 'ko' ? '필수' : 'required') : '', f.enum ? f.enum.join('|') : '', f.default !== undefined ? `= ${JSON.stringify(f.default)}` : '']
          .filter(Boolean)
          .join(', ');
        print(`  ${name.padEnd(16)}${f[locale]}${meta ? `  (${meta})` : ''}`);
      }
      print(`\n${locale === 'ko' ? '예시' : 'Example'}:\n${json(exampleSpec(type))}`);
      print(`\nReact:\n${reactCode(exampleSpec(type))}`);
      return;
    }

    case 'example': {
      const type = chartType(rest[0], locale);
      const out = json(exampleSpec(type));
      if (typeof flags.out === 'string') await write(flags.out, `${out}\n`, locale);
      else print(out);
      return;
    }

    case 'schema': {
      const type = chartType(rest[0], locale);
      const out = json(chartSchema(type, locale));
      if (typeof flags.out === 'string') await write(flags.out, `${out}\n`, locale);
      else print(out);
      return;
    }

    case 'validate': {
      if (!rest[0]) fail(t.needArg('<spec.json>'));
      const spec = await loadSpec(rest[0]!);
      const issues = validateSpec(spec, locale);
      if (issues.length === 0) return print(`✓ ${t.valid}`);
      process.stderr.write(`✗ ${t.invalid(issues.length)}\n${issues.map((i) => `  - ${i.message}`).join('\n')}\n`);
      process.exit(1);
    }

    case 'render': {
      if (!rest[0]) fail(t.needArg('<spec.json>'));
      const out = typeof flags.out === 'string' ? flags.out : fail(t.needArg('--out'));
      const spec = await loadSpec(rest[0]!);
      const issues = validateSpec(spec, locale);
      if (issues.length) fail(`✗ ${t.invalid(issues.length)}\n${issues.map((i) => `  - ${i.message}`).join('\n')}`);
      const options: RenderOptions = flags.theme === 'dark' || flags.theme === 'light' ? { theme: flags.theme } : {};
      const ext = extname(out).toLowerCase();
      if (ext === '.png') {
        try {
          const scale = typeof flags.scale === 'string' ? Number(flags.scale) : 2;
          await write(out, await renderPng(spec as ChartSpec, { ...options, scale }), locale);
        } catch (e) {
          if ((e as { code?: string }).code === 'PNG_RENDERER_MISSING') fail(t.pngMissing);
          throw e;
        }
      } else if (ext === '.html') await write(out, renderHtml(spec as ChartSpec, options), locale);
      else if (ext === '.tsx' || ext === '.jsx') await write(out, reactCode(spec as ChartSpec), locale);
      else await write(out, renderSvg(spec as ChartSpec, options), locale);
      return;
    }

    case 'suggest': {
      if (!rest[0]) fail(t.needArg('<data.csv|json>'));
      const rows = parseData(await readFile(rest[0]!, 'utf8'), rest[0]!);
      const list = suggestCharts(rows);
      print(t.suggested(list.length));
      const dir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : null;
      for (const [i, s] of list.entries()) {
        const name = `${String(i + 1).padStart(2, '0')}-${s.spec.type}`;
        print(`  ${name.padEnd(20)}${s.reason[locale]}`);
        if (dir) {
          // Reference the data file instead of copying every row into each spec.
          const spec = { ...s.spec, data: relativeTo(dir, rest[0]!) };
          await write(join(dir, `${name}.json`), `${json(spec)}\n`, locale);
          await write(join(dir, `${name}.svg`), renderSvg(s.spec), locale);
        }
      }
      return;
    }

    case 'init': {
      const dir = rest[0] ?? fail(t.needArg('<dir>'));
      const type = chartType(typeof flags.type === 'string' ? flags.type : 'line', locale);
      const spec = exampleSpec(type);
      await write(join(dir, 'spec.json'), `${json(spec)}\n`, locale);
      await write(join(dir, 'Chart.tsx'), reactCode(spec), locale);
      await write(join(dir, 'chart.svg'), renderSvg(spec), locale);
      print(t.initDone(dir));
      return;
    }

    default:
      fail(`${t.unknownCommand(command)}\n\n${t.usage}`);
  }
}

function relativeTo(dir: string, file: string) {
  const from = resolve(dir).split(/[\\/]/);
  const to = resolve(file).split(/[\\/]/);
  let i = 0;
  while (i < from.length && from[i] === to[i]) i++;
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/');
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
