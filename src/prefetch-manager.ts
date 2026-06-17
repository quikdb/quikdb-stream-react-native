import type { WHEPSession } from './whep-client';
import type { WHEPClient } from './whep-client';

interface PreConnection {
  roomID: string;
  session: WHEPSession;
}

/**
 * PrefetchManager — maintains a sliding window of pre-subscribed connections
 * around the current stream so switching feels instant (<100ms).
 */
export class PrefetchManager {
  private whep: WHEPClient;
  private windowSize: number;
  private connections = new Map<string, WHEPSession>();

  constructor(whep: WHEPClient, windowSize = 1) {
    this.whep = whep;
    this.windowSize = windowSize;
  }

  /**
   * Update the window when the user scrolls.
   * @param allRooms   Full ordered list of room IDs in the feed
   * @param currentIdx Index of the currently active room
   * @param tokens     Map of roomID → pre-subscriber token
   */
  async updateWindow(
    allRooms: string[],
    currentIdx: number,
    tokens: Map<string, string>,
  ): Promise<void> {
    const desired = new Set<string>();

    for (let d = 1; d <= this.windowSize; d++) {
      const prev = currentIdx - d;
      const next = currentIdx + d;
      if (prev >= 0) desired.add(allRooms[prev]);
      if (next < allRooms.length) desired.add(allRooms[next]);
    }

    // Close connections outside the new window
    for (const [roomID, session] of this.connections) {
      if (!desired.has(roomID)) {
        session.close();
        this.connections.delete(roomID);
      }
    }

    // Open connections for new rooms in the window
    const opens: Array<Promise<void>> = [];
    for (const roomID of desired) {
      if (!this.connections.has(roomID)) {
        const token = tokens.get(roomID);
        if (token) {
          opens.push(
            this.whep
              .preSubscribe(roomID, token)
              .then((session) => {
                this.connections.set(roomID, session);
              })
              .catch(() => {
                // Pre-subscribe failure is non-fatal — cold subscribe fallback
              }),
          );
        }
      }
    }

    await Promise.allSettled(opens);
  }

  /**
   * Promote a pre-subscribed connection to a full subscriber.
   * If not pre-connected, returns null (caller should cold-subscribe).
   */
  pop(roomID: string): WHEPSession | null {
    const session = this.connections.get(roomID) ?? null;
    if (session) {
      this.connections.delete(roomID);
    }
    return session;
  }

  /** Close all pre-subscribed connections */
  closeAll(): void {
    for (const session of this.connections.values()) {
      session.close();
    }
    this.connections.clear();
  }

  get size(): number {
    return this.connections.size;
  }
}
