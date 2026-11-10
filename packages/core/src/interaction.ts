import type { ObjectHit } from './objects/types';
import type { PaneId } from './render/renderer';

export interface HitRegion {
  area: 'plot' | 'priceAxis' | 'timeAxis' | 'none';
  pane: PaneId | null;
}

/** What the interaction layer needs from the chart. Kept narrow so gestures stay testable. */
export interface InteractionHost {
  hitTest(x: number, y: number): HitRegion;
  plotWidth(): number;
  setCrosshair(x: number, y: number, source: 'mouse' | 'touch'): void;
  clearCrosshair(): void;
  panTime(dx: number): void;
  zoomTime(anchorX: number, factor: number): void;
  /** Pans the price axis only if it is in manual (non-auto) mode. */
  panPrice(pane: PaneId, dy: number): void;
  scalePrice(pane: PaneId, factor: number): void;
  resetPriceScale(pane: PaneId): void;
  resetView(): void;

  // Objects (drawings, order lines)
  /** A drawing tool is armed: presses create drawings instead of panning. */
  toolActive(): boolean;
  hitObject(x: number, y: number, touch: boolean): ObjectHit | null;
  drawAt(x: number, y: number): void;
  drawPreview(x: number, y: number): void;
  drawRelease(x: number, y: number, moved: boolean): void;
  objectDown(hit: ObjectHit, x: number, y: number): void;
  objectMove(x: number, y: number): void;
  objectUp(moved: boolean): void;
  /** Mouse hover over an object (or nothing) — e.g. to show a fill tooltip. */
  hoverObject(hit: ObjectHit | null): void;
  clearSelection(): void;
}

type Mode =
  | 'idle'
  | 'pending'
  | 'pan'
  | 'crosshair'
  | 'pinch'
  | 'priceScale'
  | 'timeScale'
  | 'draw'
  | 'object';
interface Point {
  x: number;
  y: number;
}

const LONG_PRESS_MS = 400;
const MOVE_SLOP = 8;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24;
const VELOCITY_WINDOW_MS = 100;
const KINETIC_MIN_VELOCITY = 0.15; // px/ms
const KINETIC_STOP_VELOCITY = 0.02;
const KINETIC_FRICTION = 0.995; // per ms
const WHEEL_ZOOM_SPEED = 0.0015;
const PINCH_WHEEL_ZOOM_SPEED = 0.01;
const AXIS_DRAG_SPEED = 0.004;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Unified mouse / touch / pen gestures on top of Pointer Events.
 *
 * Desktop: hover = crosshair, drag = pan, wheel = zoom (trackpad pinch too), horizontal wheel = pan,
 *          axis drag = axis scale, double-click = reset.
 * Touch:   drag = pan with inertia, pinch = zoom, long-press = crosshair (magnet to close),
 *          double-tap = reset. Vertical swipes are left to the page (`touch-action: pan-y`).
 */
export class Interaction {
  private readonly pointers = new Map<number, Point>();
  private mode: Mode = 'idle';
  private touch = false;
  private moved = false;
  private start: Point = { x: 0, y: 0 };
  private last: Point = { x: 0, y: 0 };
  private region: HitRegion = { area: 'none', pane: null };
  private longPressTimer: ReturnType<typeof setTimeout> | undefined;
  private samples: { t: number; x: number }[] = [];
  private kineticFrame = 0;
  private pinchDistance = 0;
  private pinchMid: Point = { x: 0, y: 0 };
  private lastTap = { t: 0, x: 0, y: 0 };
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly host: InteractionHost,
    private readonly el: HTMLElement,
  ) {
    el.style.touchAction = 'pan-y';
    el.style.cursor = 'crosshair';
    this.listen('pointerdown', this.onPointerDown);
    this.listen('pointermove', this.onPointerMove);
    this.listen('pointerup', this.onPointerUp);
    this.listen('pointercancel', this.onPointerCancel);
    this.listen('pointerleave', this.onPointerLeave);
    this.listen('wheel', this.onWheel, { passive: false });
    this.listen('dblclick', this.onDoubleClick);
    this.listen('touchmove', this.onTouchMove, { passive: false });
    this.listen('contextmenu', this.onContextMenu);
  }

  destroy(): void {
    this.stopKinetic();
    clearTimeout(this.longPressTimer);
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
  }

  private listen<K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    const bound = handler.bind(this) as EventListener;
    this.el.addEventListener(type, bound, options);
    this.cleanups.push(() => this.el.removeEventListener(type, bound, options));
  }

  private local(e: { clientX: number; clientY: number }): Point {
    const rect = this.el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Pointer lifecycle ────────────────────────────────────────────────

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.stopKinetic();
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.el.setPointerCapture?.(e.pointerId);
    this.touch = e.pointerType !== 'mouse';

    if (this.pointers.size === 2) {
      this.beginPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.start = p;
    this.last = p;
    this.moved = false;
    this.samples = [{ t: performance.now(), x: p.x }];
    this.region = this.host.hitTest(p.x, p.y);

    switch (this.region.area) {
      case 'priceAxis':
        this.mode = 'priceScale';
        break;
      case 'timeAxis':
        this.mode = 'timeScale';
        break;
      case 'plot': {
        if (this.host.toolActive()) {
          this.mode = 'draw';
          this.host.drawAt(p.x, p.y);
          if (!this.touch) this.host.setCrosshair(p.x, p.y, 'mouse');
          break;
        }
        const hit = this.host.hitObject(p.x, p.y, this.touch);
        if (hit) {
          this.mode = 'object';
          this.host.objectDown(hit, p.x, p.y);
          break;
        }
        this.host.clearSelection();
        if (this.touch) {
          this.mode = 'pending';
          this.longPressTimer = setTimeout(() => this.onLongPress(), LONG_PRESS_MS);
        } else {
          this.mode = 'pan';
          this.el.style.cursor = 'grabbing';
        }
        break;
      }
      default:
        this.mode = 'idle';
    }
  }

  private onLongPress(): void {
    if (this.mode !== 'pending') return;
    this.mode = 'crosshair';
    this.host.setCrosshair(this.last.x, this.last.y, 'touch');
    navigator.vibrate?.(8);
  }

  private onPointerMove(e: PointerEvent): void {
    const p = this.local(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && this.mode === 'idle') this.hover(p);
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (!this.moved && dist(p, this.start) > MOVE_SLOP) this.moved = true;

    switch (this.mode) {
      case 'pinch':
        this.updatePinch();
        return;
      case 'draw':
        this.host.drawPreview(p.x, p.y);
        if (!this.touch) this.host.setCrosshair(p.x, p.y, 'mouse');
        break;
      case 'object':
        this.host.objectMove(p.x, p.y);
        break;
      case 'pending':
        if (!this.moved) return;
        clearTimeout(this.longPressTimer);
        this.mode = 'pan';
        this.pan(p);
        break;
      case 'pan':
        this.pan(p);
        if (!this.touch) this.host.setCrosshair(p.x, p.y, 'mouse');
        break;
      case 'crosshair':
        this.host.setCrosshair(p.x, p.y, 'touch');
        break;
      case 'priceScale':
        if (this.region.pane) this.host.scalePrice(this.region.pane, Math.exp((p.y - this.last.y) * AXIS_DRAG_SPEED));
        break;
      case 'timeScale':
        this.host.zoomTime(this.host.plotWidth(), Math.exp((p.x - this.last.x) * AXIS_DRAG_SPEED));
        break;
    }
    this.last = p;
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    clearTimeout(this.longPressTimer);

    if (this.mode === 'pinch') {
      this.endPinch();
      return;
    }
    if (this.mode === 'draw') this.host.drawRelease(p.x, p.y, this.moved);
    if (this.mode === 'object') this.host.objectUp(this.moved);
    const tapModes: Mode[] = ['pending', 'priceScale', 'timeScale'];
    if (this.touch && !this.moved && tapModes.includes(this.mode)) this.handleTap(p);
    if (this.mode === 'pan') this.startKinetic();
    if (this.mode === 'crosshair') this.host.clearCrosshair();

    this.mode = 'idle';
    if (!this.touch) this.hover(p);
  }

  private onPointerCancel(e: PointerEvent): void {
    // Fired when the browser takes over (e.g. vertical page scroll on touch).
    this.pointers.delete(e.pointerId);
    clearTimeout(this.longPressTimer);
    if (this.mode === 'pinch' && this.pointers.size > 0) {
      this.endPinch();
      return;
    }
    if (this.mode === 'object') this.host.objectUp(this.moved);
    if (this.mode === 'crosshair' || this.touch) this.host.clearCrosshair();
    this.mode = 'idle';
  }

  private onPointerLeave(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && this.mode === 'idle') {
      this.host.clearCrosshair();
      this.host.hoverObject(null);
    }
  }

  private hover(p: Point): void {
    const region = this.host.hitTest(p.x, p.y);
    let cursor = region.area === 'priceAxis' ? 'ns-resize' : region.area === 'timeAxis' ? 'ew-resize' : 'crosshair';
    let hovered: ObjectHit | null = null;
    if (region.area === 'plot') {
      if (this.host.toolActive()) {
        this.host.drawPreview(p.x, p.y);
      } else {
        const hit = this.host.hitObject(p.x, p.y, false);
        hovered = hit;
        if (hit?.kind === 'order') cursor = hit.part === 'cancel' ? 'pointer' : 'ns-resize';
        else if (hit?.kind === 'execution') cursor = 'pointer';
        else if (hit) cursor = hit.part === 'body' ? 'move' : 'grab';
      }
    }
    this.host.hoverObject(hovered);
    this.el.style.cursor = cursor;
    if (region.area === 'plot') this.host.setCrosshair(p.x, p.y, 'mouse');
    else this.host.clearCrosshair();
  }

  private pan(p: Point): void {
    this.host.panTime(p.x - this.last.x);
    if (this.region.pane) this.host.panPrice(this.region.pane, p.y - this.last.y);
    const t = performance.now();
    this.samples.push({ t, x: p.x });
    while (this.samples.length > 2 && t - this.samples[0]!.t > VELOCITY_WINDOW_MS) this.samples.shift();
  }

  private handleTap(p: Point): void {
    const t = performance.now();
    const isDouble = t - this.lastTap.t < DOUBLE_TAP_MS && dist(p, this.lastTap) < DOUBLE_TAP_SLOP;
    if (isDouble) {
      this.lastTap.t = 0;
      if (this.region.area === 'priceAxis' && this.region.pane) this.host.resetPriceScale(this.region.pane);
      else this.host.resetView();
    } else {
      this.lastTap = { t, x: p.x, y: p.y };
    }
  }

  // ── Pinch ───────────────────────────────────────────────────────────

  private pinchPoints(): [Point, Point] {
    const [a, b] = [...this.pointers.values()];
    return [a!, b!];
  }

  private beginPinch(): void {
    clearTimeout(this.longPressTimer);
    this.host.clearCrosshair();
    this.mode = 'pinch';
    const [a, b] = this.pinchPoints();
    this.pinchDistance = dist(a, b);
    this.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private updatePinch(): void {
    if (this.pointers.size < 2) return;
    const [a, b] = this.pinchPoints();
    const d = dist(a, b);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (this.pinchDistance > 0 && d > 0) this.host.zoomTime(mid.x, d / this.pinchDistance);
    this.host.panTime(mid.x - this.pinchMid.x);
    this.pinchDistance = d;
    this.pinchMid = mid;
  }

  private endPinch(): void {
    const remaining = [...this.pointers.values()][0];
    if (remaining) {
      // Continue as a one-finger pan from where the finger is, without jumping.
      this.mode = 'pan';
      this.moved = true;
      this.last = remaining;
      this.region = this.host.hitTest(remaining.x, remaining.y);
      this.samples = [];
    } else {
      this.mode = 'idle';
    }
  }

  // ── Inertia ─────────────────────────────────────────────────────────

  private startKinetic(): void {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || last.t - first.t <= 0 || performance.now() - last.t > 50) return;
    let velocity = (last.x - first.x) / (last.t - first.t);
    if (Math.abs(velocity) < KINETIC_MIN_VELOCITY) return;

    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - prev);
      prev = now;
      this.host.panTime(velocity * dt);
      velocity *= KINETIC_FRICTION ** dt;
      this.kineticFrame = Math.abs(velocity) > KINETIC_STOP_VELOCITY ? requestAnimationFrame(step) : 0;
    };
    this.kineticFrame = requestAnimationFrame(step);
  }

  private stopKinetic(): void {
    if (this.kineticFrame) cancelAnimationFrame(this.kineticFrame);
    this.kineticFrame = 0;
  }

  // ── Wheel / misc ────────────────────────────────────────────────────

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.stopKinetic();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.el.clientHeight : 1;
    let dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const region = this.host.hitTest(p.x, p.y);

    if (region.area === 'priceAxis' && region.pane) {
      this.host.scalePrice(region.pane, Math.exp(dy * 0.002));
      return;
    }
    if (e.ctrlKey) {
      // Trackpad pinch arrives as ctrl+wheel.
      this.host.zoomTime(p.x, Math.exp(-dy * PINCH_WHEEL_ZOOM_SPEED));
      return;
    }
    if (e.shiftKey && dx === 0) dx = dy;
    if (Math.abs(dx) > Math.abs(dy) || e.shiftKey) this.host.panTime(-dx);
    else this.host.zoomTime(Math.min(p.x, this.host.plotWidth()), Math.exp(-dy * WHEEL_ZOOM_SPEED));
  }

  private onDoubleClick(e: MouseEvent): void {
    if (this.touch) return; // touch double-taps are handled in handleTap
    const p = this.local(e);
    const region = this.host.hitTest(p.x, p.y);
    if (region.area === 'priceAxis' && region.pane) this.host.resetPriceScale(region.pane);
    else if (region.area !== 'none') this.host.resetView();
  }

  private onTouchMove(e: TouchEvent): void {
    // Once a gesture belongs to the chart, stop the page from scrolling.
    if (this.mode !== 'idle' && this.mode !== 'pending') e.preventDefault();
  }

  private onContextMenu(e: MouseEvent): void {
    if (this.touch) e.preventDefault(); // long-press would otherwise open the context menu
  }
}
