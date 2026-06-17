import type { MediaStream as RNMediaStream } from 'react-native-webrtc';

/** Configuration passed to QuikDBStream.init() */
export interface StreamConfig {
  /** API key from QuikDB dashboard (qs_live_xxx or qs_test_xxx) */
  apiKey: string;
  /** SFU server URL (defaults to https://stream.quikdb.com) */
  serverUrl?: string;
  /** STUN/TURN servers (optional, SFU provides defaults) */
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

/** Options for creating a feed (scroll-feed use case) */
export interface FeedOptions {
  /** Room IDs to include in the feed */
  streams: string[];
  /** How many adjacent streams to pre-connect (default: 1) */
  prefetch?: number;
}

/** Options for single-stream playback */
export interface PlayOptions {
  /** Room ID to watch */
  room: string;
  /** Auto-play when stream is live (default: true) */
  autoplay?: boolean;
}

/** Options for broadcasting */
export interface BroadcastOptions {
  /** Room ID to broadcast to */
  room: string;
  /** Enable simulcast encoding (default: true) */
  simulcast?: boolean;
  /** Video constraints */
  video?: boolean | { width?: number; height?: number; frameRate?: number };
  /** Audio constraints */
  audio?: boolean;
}

/** Token returned from the control API */
export interface StreamToken {
  token: string;
  roomID: string;
  role: 'publisher' | 'subscriber' | 'pre-subscriber';
}

/** Room info from control API */
export interface RoomInfo {
  id: string;
  status: 'created' | 'waiting' | 'live' | 'ended';
  viewerCount: number;
  peakViewers: number;
  publisherConnected: boolean;
}

/** Batch feed response from POST /v1/feeds */
export interface FeedResponse {
  tokens: StreamToken[];
}

/** Event types emitted by the SDK */
export type StreamEventType =
  | 'streamActive'
  | 'streamEnded'
  | 'viewerCount'
  | 'qualityChange'
  | 'error'
  | 'reconnecting'
  | 'reconnected'
  | 'switched';

/** Stream event payload */
export interface StreamEvent {
  type: StreamEventType;
  roomID?: string;
  data?: Record<string, unknown>;
}

/** Quality layers for ABR */
export type QualityLayer = 0 | 1 | 2;
export type LayerLabel = 'low' | 'mid' | 'high';
