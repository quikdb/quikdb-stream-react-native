import type { MediaStream as RNMediaStream } from 'react-native-webrtc';
import type {
  StreamConfig,
  FeedOptions,
  PlayOptions,
  BroadcastOptions,
  StreamEvent,
} from './types';
import { StreamClient } from './client';
import { WHEPClient, WHEPSession } from './whep-client';
import { WHIPClient, WHIPSession } from './whip-client';
import { FeedController } from './feed-controller';

const DEFAULT_SERVER_URL = 'https://stream.quikdb.com';

/**
 * QuikDBStream — top-level API for React Native.
 *
 * Usage:
 *   const sdk = QuikDBStream.init({ apiKey: 'qs_live_xxx' });
 *   const feed = await sdk.createFeed({ streams: [...] });
 *   const session = await feed.switchTo(0);
 */
export class QuikDBStream {
  private httpClient: StreamClient;
  private whep: WHEPClient;
  private whip: WHIPClient;

  private constructor(config: StreamConfig) {
    const url = config.serverUrl ?? DEFAULT_SERVER_URL;
    this.httpClient = new StreamClient(url, config.apiKey);
    this.whep = new WHEPClient(this.httpClient, config.iceServers);
    this.whip = new WHIPClient(this.httpClient, config.iceServers);
  }

  /** Create and configure an SDK instance */
  static init(config: StreamConfig): QuikDBStream {
    if (!config.apiKey) throw new Error('QuikDB Stream: apiKey is required');
    return new QuikDBStream(config);
  }

  /**
   * Create a scroll feed with instant stream switching.
   *
   * @example
   *   const feed = await sdk.createFeed({ streams: ['room1', 'room2', 'room3'] });
   *   const session = await feed.switchTo(0);
   *   // Attach session.stream to an RTCView
   */
  async createFeed(
    options: FeedOptions,
    onEvent?: (event: StreamEvent) => void,
  ): Promise<FeedController> {
    const feed = new FeedController(
      this.httpClient,
      this.whep,
      options.prefetch ?? 1,
    );
    if (onEvent) feed.onEvent(onEvent);
    await feed.initialize(options.streams);
    return feed;
  }

  /**
   * Watch a single stream.
   *
   * @example
   *   const session = await sdk.play({ room: 'room1' });
   *   // Attach session.stream to an RTCView
   */
  async play(
    options: PlayOptions,
    onEvent?: (event: StreamEvent) => void,
  ): Promise<WHEPSession> {
    const room = await this.httpClient.getRoom(options.room);
    if (room.status === 'ended') {
      throw new Error(`Room ${options.room} has ended`);
    }

    const feed = await this.createFeed(
      { streams: [options.room], prefetch: 0 },
      onEvent,
    );
    return feed.switchTo(0);
  }

  /**
   * Broadcast from this device to a room.
   *
   * @example
   *   const session = await sdk.broadcast({ room: 'room1' });
   *   // session.stream is the local preview stream
   */
  async broadcast(options: BroadcastOptions): Promise<WHIPSession> {
    const { publisherToken } = await this.httpClient.createRoom(options.room);
    return this.whip.captureAndPublish(
      options.room,
      publisherToken.token,
      { video: options.video, audio: options.audio },
      options.simulcast ?? true,
    );
  }
}
