import {
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream as RNMediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import type { StreamClient } from './client';

export interface WHIPSession {
  pc: RTCPeerConnection;
  stream: RNMediaStream;
  close: () => void;
}

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * WHIP client for React Native — broadcasts local media to the SFU.
 */
export class WHIPClient {
  private client: StreamClient;
  private iceServers: Array<{ urls: string | string[] }>;

  constructor(
    client: StreamClient,
    iceServers?: Array<{ urls: string | string[] }>,
  ) {
    this.client = client;
    this.iceServers = iceServers ?? DEFAULT_ICE_SERVERS;
  }

  /** Publish a media stream to a room */
  async publish(
    roomID: string,
    token: string,
    stream: RNMediaStream,
    simulcast = true,
  ): Promise<WHIPSession> {
    const config = {
      iceServers: this.iceServers,
      sdpSemantics: 'unified-plan' as const,
    };

    const pc = new RTCPeerConnection(config);

    // Add tracks with simulcast encoding
    for (const track of stream.getTracks()) {
      if (track.kind === 'video' && simulcast) {
        pc.addTransceiver(track, {
          direction: 'sendonly',
          sendEncodings: [
            { rid: 'low', maxBitrate: 300000, scaleResolutionDownBy: 4 },
            { rid: 'mid', maxBitrate: 1000000, scaleResolutionDownBy: 2 },
            { rid: 'high', maxBitrate: 3000000, scaleResolutionDownBy: 1 },
          ],
        });
      } else {
        pc.addTransceiver(track, { direction: 'sendonly' });
      }
    }

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    await this.waitForICEGathering(pc);

    const localDesc = await pc.localDescription;
    const answerSdp = await this.client.whipIngest(
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
      close: () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        pc.close();
      },
    };
  }

  /** Capture camera/mic and publish */
  async captureAndPublish(
    roomID: string,
    token: string,
    constraints?: { video?: boolean | object; audio?: boolean },
    simulcast = true,
  ): Promise<WHIPSession> {
    const stream = await mediaDevices.getUserMedia({
      video: constraints?.video ?? true,
      audio: constraints?.audio ?? true,
    });
    return this.publish(roomID, token, stream as RNMediaStream, simulcast);
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
