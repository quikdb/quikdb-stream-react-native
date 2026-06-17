import type { FeedResponse, RoomInfo, StreamToken } from './types';

/**
 * HTTP client for the QuikDB Stream Control API.
 */
export class StreamClient {
  private serverUrl: string;
  private apiKey: string;

  constructor(serverUrl: string, apiKey: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  /** Create a room and get publisher + viewer tokens */
  async createRoom(roomID: string): Promise<{
    room: RoomInfo;
    publisherToken: StreamToken;
    whipUrl: string;
    whepUrl: string;
  }> {
    return this.request('POST', '/v1/rooms', { roomID });
  }

  /** Get room info */
  async getRoom(roomID: string): Promise<RoomInfo> {
    return this.request('GET', `/v1/rooms/${roomID}`);
  }

  /** Batch pre-mint tokens for a feed of streams */
  async createFeed(roomIDs: string[]): Promise<FeedResponse> {
    return this.request('POST', '/v1/feeds', { roomIDs });
  }

  /** Get room stats */
  async getRoomStats(roomID: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/v1/rooms/${roomID}/stats`);
  }

  /** WHEP subscribe — send SDP offer, get SDP answer */
  async whepSubscribe(roomID: string, offerSdp: string, token: string): Promise<string> {
    const res = await fetch(`${this.serverUrl}/whep/${roomID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: `Bearer ${token}`,
      },
      body: offerSdp,
    });
    if (!res.ok) {
      throw new Error(`WHEP subscribe failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  /** WHEP pre-subscribe — lightweight connection for keyframes only */
  async whepPreSubscribe(roomID: string, offerSdp: string, token: string): Promise<string> {
    const res = await fetch(`${this.serverUrl}/whep/${roomID}/pre`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: `Bearer ${token}`,
      },
      body: offerSdp,
    });
    if (!res.ok) {
      throw new Error(`WHEP pre-subscribe failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  /** Activate a pre-subscriber to full subscriber */
  async whepActivate(roomID: string, offerSdp: string, token: string): Promise<string> {
    const res = await fetch(`${this.serverUrl}/whep/${roomID}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: `Bearer ${token}`,
      },
      body: offerSdp,
    });
    if (!res.ok) {
      throw new Error(`WHEP activate failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  /** WHIP ingest — send SDP offer, get SDP answer */
  async whipIngest(roomID: string, offerSdp: string, token: string): Promise<string> {
    const res = await fetch(`${this.serverUrl}/whip/${roomID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: `Bearer ${token}`,
      },
      body: offerSdp,
    });
    if (!res.ok) {
      throw new Error(`WHIP ingest failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  /** Close a room */
  async closeRoom(roomID: string): Promise<void> {
    await this.request('DELETE', `/v1/rooms/${roomID}`);
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stream API ${method} ${path}: ${res.status} ${text}`);
    }
    return res.json();
  }
}
