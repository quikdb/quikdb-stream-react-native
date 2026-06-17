import type { StreamToken, StreamEvent } from './types';
import type { WHEPClient, WHEPSession } from './whep-client';
import type { StreamClient } from './client';
import { PrefetchManager } from './prefetch-manager';

export interface FeedState {
  roomID: string;
  session: WHEPSession;
  index: number;
}

type EventHandler = (event: StreamEvent) => void;

/**
 * FeedController — manages scroll-feed navigation with instant stream switching.
 *
 * Uses pre-subscribe connections maintained by PrefetchManager so that
 * switching to an adjacent stream takes <100ms.
 */
export class FeedController {
  private httpClient: StreamClient;
  private whep: WHEPClient;
  private prefetch: PrefetchManager;
  private rooms: string[] = [];
  private tokens = new Map<string, string>();
  private currentIndex = -1;
  private currentSession: WHEPSession | null = null;
  private handler: EventHandler | null = null;

  constructor(
    httpClient: StreamClient,
    whep: WHEPClient,
    prefetchWindow = 1,
  ) {
    this.httpClient = httpClient;
    this.whep = whep;
    this.prefetch = new PrefetchManager(whep, prefetchWindow);
  }

  /** Set event callback */
  onEvent(handler: EventHandler): void {
    this.handler = handler;
  }

  /**
   * Initialize feed with a list of room IDs.
   * Mints tokens for all rooms and starts prefetching.
   */
  async initialize(roomIDs: string[]): Promise<void> {
    this.rooms = roomIDs;
    const resp = await this.httpClient.createFeed(roomIDs);
    for (const t of resp.tokens) {
      if (t.role === 'pre-subscriber' || t.role === 'subscriber') {
        this.tokens.set(t.roomID, t.token);
      }
    }
  }

  /**
   * Switch to a specific room by index.
   * Tries pre-connection first; falls back to cold subscribe.
   */
  async switchTo(index: number): Promise<WHEPSession> {
    if (index < 0 || index >= this.rooms.length) {
      throw new Error(`Feed index ${index} out of range`);
    }

    const roomID = this.rooms[index];

    // Close current session
    if (this.currentSession) {
      this.currentSession.close();
      this.currentSession = null;
    }

    this.currentIndex = index;

    // Try pre-connected session first (instant)
    const preSession = this.prefetch.pop(roomID);
    let session: WHEPSession;

    if (preSession) {
      const token = this.tokens.get(roomID);
      if (token) {
        try {
          session = await this.whep.activate(
            roomID,
            token,
            preSession.pc,
            preSession.stream,
          );
        } catch {
          // Activation failed — fall through to cold subscribe
          preSession.close();
          session = await this.coldSubscribe(roomID);
        }
      } else {
        preSession.close();
        session = await this.coldSubscribe(roomID);
      }
    } else {
      session = await this.coldSubscribe(roomID);
    }

    this.currentSession = session;

    this.emit({ type: 'switched', roomID, data: { index } });

    // Update prefetch window asynchronously
    void this.prefetch.updateWindow(this.rooms, index, this.tokens);

    return session;
  }

  /** Switch to next stream */
  async next(): Promise<WHEPSession | null> {
    if (this.currentIndex + 1 >= this.rooms.length) return null;
    return this.switchTo(this.currentIndex + 1);
  }

  /** Switch to previous stream */
  async previous(): Promise<WHEPSession | null> {
    if (this.currentIndex - 1 < 0) return null;
    return this.switchTo(this.currentIndex - 1);
  }

  /** Current room ID */
  get currentRoom(): string | null {
    return this.currentIndex >= 0 ? this.rooms[this.currentIndex] : null;
  }

  /** Total number of rooms in the feed */
  get length(): number {
    return this.rooms.length;
  }

  /** Tear down all connections */
  destroy(): void {
    this.currentSession?.close();
    this.currentSession = null;
    this.prefetch.closeAll();
  }

  private async coldSubscribe(roomID: string): Promise<WHEPSession> {
    const token = this.tokens.get(roomID);
    if (!token) throw new Error(`No token for room ${roomID}`);
    return this.whep.subscribe(roomID, token);
  }

  private emit(event: StreamEvent): void {
    this.handler?.(event);
  }
}
