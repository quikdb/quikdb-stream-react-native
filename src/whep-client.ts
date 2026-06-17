import {
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream as RNMediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import type { StreamClient } from './client';

export interface WHEPSession {
  pc: RTCPeerConnection;
  stream: RNMediaStream;
  close: () => void;
}

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * WHEP client for React Native — establishes WebRTC viewer connections.
 */
export class WHEPClient {
  private client: StreamClient;
  private iceServers: Array<{ urls: string | string[] }>;

  constructor(
    client: StreamClient,
    iceServers?: Array<{ urls: string | string[] }>,
  ) {
    this.client = client;
    this.iceServers = iceServers ?? DEFAULT_ICE_SERVERS;
  }

  /** Full subscribe — receives all media, connection is billed */
  async subscribe(roomID: string, token: string): Promise<WHEPSession> {
    return this.connect(roomID, token, false);
  }

  /** Pre-subscribe — lightweight connection, keyframes only, FREE */
  async preSubscribe(roomID: string, token: string): Promise<WHEPSession> {
    return this.connect(roomID, token, true);
  }

  /** Activate a pre-subscribed connection to full subscriber */
  async activate(
    roomID: string,
    token: string,
    pc: RTCPeerConnection,
    stream: RNMediaStream,
  ): Promise<WHEPSession> {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    await this.waitForICEGathering(pc);

    const localDesc = await pc.localDescription;
    const answerSdp = await this.client.whepActivate(
      roomID,
      localDesc!.sdp,
      token,
    );

    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: answerSdp }),
    );

    return {
      pc,
      stream,
      close: () => pc.close(),
    };
  }

  private async connect(
    roomID: string,
    token: string,
    preSubscribe: boolean,
  ): Promise<WHEPSession> {
    const config = {
      iceServers: this.iceServers,
      sdpSemantics: 'unified-plan' as const,
    };

    const pc = new RTCPeerConnection(config);
    const stream = new RNMediaStream([]);

    // Add receive-only transceivers
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // Capture remote tracks (cast to any — RN WebRTC types don't expose EventTarget)
    (pc as any).addEventListener('track', (event: any) => {
      if (event.track) {
        stream.addTrack(event.track);
      }
    });

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    await this.waitForICEGathering(pc);

    const localDesc = await pc.localDescription;
    const answerSdp = preSubscribe
      ? await this.client.whepPreSubscribe(roomID, localDesc!.sdp, token)
      : await this.client.whepSubscribe(roomID, localDesc!.sdp, token);

    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: answerSdp }),
    );

    return {
      pc,
      stream,
      close: () => pc.close(),
    };
  }

  private waitForICEGathering(
    pc: RTCPeerConnection,
    timeoutMs = 2000,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, timeoutMs);

      (pc as any).addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }
}
