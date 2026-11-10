# @funnest/charts-cli

차트 스펙 검사, SVG·PNG·HTML 렌더, 차트 추천, React 코드 생성

Command line: validate JSON chart specs, render SVG/PNG/HTML, suggest charts, generate React code.

```bash
npx @funnest/charts-cli list
npx @funnest/charts-cli info bar
npx @funnest/charts-cli example line --out spec.json
npx @funnest/charts-cli validate spec.json
npx @funnest/charts-cli render spec.json --out chart.png --theme dark --scale 2
npx @funnest/charts-cli render spec.json --out Chart.tsx      # 같은 차트의 React 코드
npx @funnest/charts-cli suggest data.csv --out-dir charts
```

프로젝트에 설치하면 `funnest-charts` 명령으로 써요. `--locale en`으로 영어 메시지.
PNG는 선택 의존성인 `@resvg/resvg-js`로 그려요.

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts
- 라이선스: Apache-2.0
