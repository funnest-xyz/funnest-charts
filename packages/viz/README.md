# @funnest/charts-viz

웹과 React Native가 함께 쓰는 차트 계산

Platform-neutral chart math (scales, ticks, SVG paths, stacking) for web and React Native.

```bash
npm i @funnest/charts-viz
```

DOM을 쓰지 않는 순수 TypeScript예요. `@funnest/charts-react`의 SVG 컴포넌트가 이 계산을 쓰고, React Native(react-native-svg)에서도 같은 결과를 그릴 수 있어요.

```ts
import { linearScale, linePath, ticks } from '@funnest/charts-viz';

const y = linearScale([0, 100], [200, 0]);
const d = linePath(values.map((v, i) => ({ x: i * 10, y: y(v) })), 'monotone');
```

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/charts
- 라이선스: Apache-2.0
