import type { RoomInfo, FeedResponse, StreamConfig, QualityLayer, StreamEvent } from '../types';

describe('Types', () => {
  describe('RoomInfo', () => {
    it('accepts valid room info', () => {
      const room: RoomInfo = {
        id: 'room-1',
        status: 'live',
        viewerCount: 42,
        peakViewers: 100,
        publisherConnected: true,
      };
      expect(room.id).toBe('room-1');
      expect(room.status).toBe('live');
    });

    it('accepts all valid statuses', () => {
      const statuses: RoomInfo['status'][] = ['created', 'waiting', 'live', 'ended'];
      statuses.forEach((status) => {
        const room: RoomInfo = {
          id: 'room',
          status,
          viewerCount: 0,
          peakViewers: 0,
          publisherConnected: false,
        };
        expect(room.status).toBe(status);
      });
    });
  });

  describe('FeedResponse', () => {
    it('accepts a valid feed response', () => {
      const resp: FeedResponse = {
        tokens: [
          { token: 'tok1', roomID: 'room-1', role: 'subscriber' },
          { token: 'tok2', roomID: 'room-2', role: 'pre-subscriber' },
        ],
      };
      expect(resp.tokens).toHaveLength(2);
      expect(resp.tokens[0].role).toBe('subscriber');
    });
  });

  describe('StreamConfig', () => {
    it('requires only apiKey', () => {
      const config: StreamConfig = { apiKey: 'qs_live_abc' };
      expect(config.apiKey).toBe('qs_live_abc');
      expect(config.serverUrl).toBeUndefined();
    });

    it('accepts optional fields', () => {
      const config: StreamConfig = {
        apiKey: 'qs_live_abc',
        serverUrl: 'https://my-sfu.example.com',
        iceServers: [{ urls: 'stun:stun.example.com' }],
      };
      expect(config.serverUrl).toBe('https://my-sfu.example.com');
      expect(config.iceServers).toHaveLength(1);
    });
  });

  describe('QualityLayer', () => {
    it('accepts all valid layers', () => {
      const layers: QualityLayer[] = [0, 1, 2];
      layers.forEach((l) => {
        expect([0, 1, 2]).toContain(l);
      });
    });
  });

  describe('StreamEvent', () => {
    it('builds a switched event', () => {
      const event: StreamEvent = {
        type: 'switched',
        roomID: 'room-1',
        data: { index: 3 },
      };
      expect(event.type).toBe('switched');
      expect(event.data?.index).toBe(3);
    });

    it('builds an error event without roomID', () => {
      const event: StreamEvent = {
        type: 'error',
        data: { reason: 'connection failed' },
      };
      expect(event.type).toBe('error');
      expect(event.roomID).toBeUndefined();
    });
  });
});
