# @funnest/charts-viz

Platform-neutral chart math (scales, ticks, SVG paths, stacking) shared by the web and React Native.

```bash
npm i @funnest/charts-viz
```

Pure TypeScript with no DOM. The SVG components in `@funnest/charts-react` use it, and React Native (react-native-svg) can draw the same results.

```ts
import { linearScale, linePath, ticks } from '@funnest/charts-viz';

const y = linearScale([0, 100], [200, 0]);
const d = linePath(values.map((v, i) => ({ x: i * 10, y: y(v) })), 'monotone');
```

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
