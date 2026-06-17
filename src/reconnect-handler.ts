import type { RTCPeerConnection } from 'react-native-webrtc';
import type { StreamEvent } from './types';

export interface ReconnectConfig {
  /** Max reconnect attempts before giving up (default: 5) */
  maxAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs?: number;
  /** Max delay cap in ms (default: 30000) */
  maxDelayMs?: number;
}

const DEFAULTS: Required<ReconnectConfig> = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

type ReconnectFn = () => Promise<void>;
type EventHandler = (event: StreamEvent) => void;

/**
 * ReconnectHandler — handles ICE restarts and full reconnection with
 * exponential backoff.
 */
export class ReconnectHandler {
  private pc: RTCPeerConnection;
  private config: Required<ReconnectConfig>;
  private reconnectFn: ReconnectFn;
  private attempts = 0;
  private aborted = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handler: EventHandler | null = null;

  constructor(
    pc: RTCPeerConnection,
    reconnectFn: ReconnectFn,
    config?: ReconnectConfig,
  ) {
    this.pc = pc;
    this.reconnectFn = reconnectFn;
    this.config = { ...DEFAULTS, ...config };
    this.watchICE();
  }

  /** Set event callback for reconnecting/reconnected/error events */
  onEvent(handler: EventHandler): void {
    this.handler = handler;
  }

  /** Abort all reconnection attempts */
  abort(): void {
    this.aborted = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Reset attempt counter (call after successful reconnect) */
  reset(): void {
    this.attempts = 0;
    this.aborted = false;
  }

  private watchICE(): void {
    (this.pc as any).addEventListener('iceconnectionstatechange', () => {
      if (this.aborted) return;
      const state = this.pc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        void this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): Promise<void> {
    if (this.aborted) return Promise.resolve();
    if (this.attempts >= this.config.maxAttempts) {
      this.emit({ type: 'error', data: { reason: 'max reconnect attempts reached' } });
      return Promise.resolve();
    }

    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, this.attempts),
      this.config.maxDelayMs,
    );
    this.attempts++;
    this.emit({ type: 'reconnecting', data: { attempt: this.attempts, delayMs: delay } });

    return new Promise((resolve) => {
      this.timer = setTimeout(async () => {
        if (this.aborted) {
          resolve();
          return;
        }
        try {
          await this.reconnectFn();
          this.reset();
          this.emit({ type: 'reconnected', data: { attempt: this.attempts } });
        } catch {
          void this.scheduleReconnect();
        }
        resolve();
      }, delay);
    });
  }

  private emit(event: StreamEvent): void {
    this.handler?.(event);
  }
}
