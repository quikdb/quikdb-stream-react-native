/**
 * Manual mock for react-native-webrtc in Jest (Node environment).
 * react-native-webrtc requires native modules; this stub is sufficient for unit tests.
 */

export class RTCPeerConnection {
  iceGatheringState = 'complete';
  iceConnectionState = 'connected';
  localDescription: { sdp: string; type: string } | null = null;

  private listeners: Record<string, Array<(event?: any) => void>> = {};

  addTransceiver = jest.fn();
  createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' });
  setLocalDescription = jest.fn().mockImplementation(async (desc) => {
    this.localDescription = desc;
  });
  setRemoteDescription = jest.fn().mockResolvedValue(undefined);
  getStats = jest.fn().mockResolvedValue(new Map());
  close = jest.fn();

  addEventListener(event: string, fn: (e?: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event: string, data?: any) {
    (this.listeners[event] ?? []).forEach((fn) => fn(data));
  }
}

export class RTCSessionDescription {
  type: string;
  sdp: string;
  constructor({ type, sdp }: { type: string; sdp: string }) {
    this.type = type;
    this.sdp = sdp;
  }
}

export class MediaStream {
  private tracks: any[] = [];

  getTracks() { return this.tracks; }
  addTrack(track: any) { this.tracks.push(track); }
  removeTrack(track: any) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

export const mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(new MediaStream()),
};
