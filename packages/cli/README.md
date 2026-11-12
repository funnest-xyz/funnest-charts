# @funnest/charts-cli

Command line for Funnest Charts: validate JSON chart specs, render SVG/PNG/HTML, suggest charts for your data and generate React code.

```bash
npx @funnest/charts-cli list
npx @funnest/charts-cli info bar
npx @funnest/charts-cli example line --out spec.json
npx @funnest/charts-cli validate spec.json
npx @funnest/charts-cli render spec.json --out chart.png --theme dark --scale 2
npx @funnest/charts-cli render spec.json --out Chart.tsx      # the same chart as React code
npx @funnest/charts-cli suggest data.csv --out-dir charts
```

Installed in a project, the command is `funnest-charts`. Messages follow your system language (English, or Korean on a Korean system); `--locale en` or `--locale ko` picks one.
PNG rendering uses the optional dependency `@resvg/resvg-js`.

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
