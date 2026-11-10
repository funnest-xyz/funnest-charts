export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ReconnectingWebSocketOptions {
  /** Runs on every (re)connect — send subscription messages here. `reconnected` is false the first time. */
  onOpen?(socket: WebSocket, reconnected: boolean): void;
  /** Text frames as-is; binary frames decoded as UTF-8 (Upbit sends binary JSON). */
  onMessage(data: string): void;
  onStatus?(status: SocketStatus): void;
  /** First retry delay. Default 500ms; doubles each attempt with jitter. */
  minDelay?: number;
  /** Retry delay cap. Default 15s. */
  maxDelay?: number;
  /** Force a reconnect when nothing arrives for this long (half-open connections). 0 = off. */
  idleTimeout?: number;
  /**
   * Application-level ping to measure round-trip latency (browsers can't send WS ping frames).
   * Pong messages are consumed and not passed to `onMessage`.
   */
  ping?: { interval: number; message: () => string; isPong: (data: string) => boolean };
  onLatency?(ms: number): void;
}

/** Maps socket states onto the chart's ConnectionState vocabulary. */
export const toConnectionStatus = (status: SocketStatus) =>
  (({ connecting: 'connecting', open: 'connected', reconnecting: 'reconnecting', closed: 'disconnected' }) as const)[status];

// Created on first binary frame, so importing core never requires TextDecoder (older React Native).
let decoder: TextDecoder | undefined;
const decode = (data: ArrayBuffer) => (decoder ??= new TextDecoder()).decode(data);

/**
 * WebSocket that never gives up: exponential backoff with jitter, immediate retry when the
 * browser comes back online, and an optional idle watchdog. Pair `onOpen(…, reconnected)`
 * with the datafeed's `onResetCache` so the chart refetches bars missed while disconnected.
 */
export class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private everOpened = false;
  private closed = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pingSentAt = 0;
  private readonly onOnline = () => {
    if (this.ws || this.closed) return;
    clearTimeout(this.retryTimer);
    this.connect();
  };

  constructor(
    private readonly url: string,
    private readonly options: ReconnectingWebSocketOptions,
  ) {
    globalThis.addEventListener?.('online', this.onOnline);
    this.connect();
  }

  get status(): SocketStatus {
    if (this.closed) return 'closed';
    if (this.ws?.readyState === WebSocket.OPEN) return 'open';
    return this.everOpened ? 'reconnecting' : 'connecting';
  }

  /** Drops the current connection and reconnects right away (e.g. after the tab wakes up). */
  reconnect(): void {
    if (this.closed) return;
    clearTimeout(this.retryTimer);
    if (this.ws) this.drop(this.ws, 0);
    else this.connect();
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.idleTimer);
    clearInterval(this.pingTimer);
    globalThis.removeEventListener?.('online', this.onOnline);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.options.onStatus?.('closed');
  }

  private connect(): void {
    if (this.closed) return;
    this.options.onStatus?.(this.everOpened ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      const reconnected = this.everOpened;
      this.everOpened = true;
      this.attempt = 0;
      this.armIdle();
      this.options.onStatus?.('open');
      this.options.onOpen?.(ws, reconnected);
      this.startPing(ws);
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.armIdle();
      const text = typeof event.data === 'string' ? event.data : decode(event.data as ArrayBuffer);
      const ping = this.options.ping;
      if (ping && this.pingSentAt && ping.isPong(text)) {
        this.options.onLatency?.(Math.round(performance.now() - this.pingSentAt));
        this.pingSentAt = 0;
        return;
      }
      this.options.onMessage(text);
    };
    ws.onerror = () => this.drop(ws);
    ws.onclose = () => this.drop(ws);
  }

  /**
   * Abandons a socket and schedules the next attempt immediately. Doesn't wait for the
   * close handshake: on a dead network the server never answers, and `close()` alone would
   * leave us hanging with no `onclose` for a long time.
   */
  private drop(ws: WebSocket, delay?: number): void {
    if (this.ws !== ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
    clearTimeout(this.idleTimer);
    clearInterval(this.pingTimer);
    this.scheduleReconnect(delay);
  }

  private startPing(ws: WebSocket): void {
    const ping = this.options.ping;
    if (!ping) return;
    clearInterval(this.pingTimer);
    const send = () => {
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
      this.pingSentAt = performance.now();
      ws.send(ping.message());
    };
    send();
    this.pingTimer = setInterval(send, ping.interval);
  }

  private scheduleReconnect(override?: number): void {
    if (this.closed) return;
    const min = this.options.minDelay ?? 500;
    const max = this.options.maxDelay ?? 15_000;
    const delay = override ?? Math.min(max, min * 2 ** this.attempt) * (0.5 + Math.random() * 0.5);
    this.attempt++;
    this.options.onStatus?.('reconnecting');
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private armIdle(): void {
    const timeout = this.options.idleTimeout ?? 0;
    if (!timeout) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.ws && this.drop(this.ws), timeout);
  }
}
