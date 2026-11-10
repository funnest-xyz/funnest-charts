/**
 * Canvas can't read CSS variables, so `var(--x)` theme values are resolved through
 * a hidden probe element living inside the chart (inheriting the host page's variables).
 * Plain colors pass through untouched.
 */
export class ColorResolver {
  private readonly cache = new Map<string, string>();

  constructor(private readonly probe: HTMLElement) {}

  color(value: string): string {
    if (!value.includes('var(')) return value;
    return this.lookup(`c:${value}`, () => {
      this.probe.style.color = '';
      this.probe.style.color = value;
      return getComputedStyle(this.probe).color;
    });
  }

  fontFamily(value: string): string {
    if (!value.includes('var(')) return value;
    return this.lookup(`f:${value}`, () => {
      this.probe.style.fontFamily = '';
      this.probe.style.fontFamily = value;
      return getComputedStyle(this.probe).fontFamily;
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private lookup(key: string, compute: () => string): string {
    let v = this.cache.get(key);
    if (v === undefined) {
      v = compute();
      this.cache.set(key, v);
    }
    return v;
  }
}
