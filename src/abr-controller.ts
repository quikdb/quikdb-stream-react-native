import type { RTCPeerConnection } from 'react-native-webrtc';
import type { QualityLayer } from './types';

export interface ABRConfig {
  /** Poll interval in ms (default: 2000) */
  pollIntervalMs?: number;
  /** Loss % threshold to step down (default: 5) */
  lossThresholdDown?: number;
  /** Loss % threshold to step up (default: 1) */
  lossThresholdUp?: number;
  /** RTT ms threshold to step down (default: 300) */
  rttThresholdDown?: number;
  /** RTT ms threshold to step up (default: 150) */
  rttThresholdUp?: number;
}

const DEFAULTS: Required<ABRConfig> = {
  pollIntervalMs: 2000,
  lossThresholdDown: 5,
  lossThresholdUp: 1,
  rttThresholdDown: 300,
  rttThresholdUp: 150,
};

/**
 * ABRController — monitors WebRTC stats and adjusts the quality layer.
 *
 * Drives the SFU layer via onLayerChange callback so the SFU sends
 * only the appropriate simulcast layer.
 */
export class ABRController {
  private pc: RTCPeerConnection;
  private config: Required<ABRConfig>;
  private layer: QualityLayer = 2; // start high
  private forcedLayer: QualityLayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  onLayerChange?: (layer: QualityLayer) => void;

  constructor(pc: RTCPeerConnection, config?: ABRConfig) {
    this.pc = pc;
    this.config = { ...DEFAULTS, ...config };
  }

  /** Start polling WebRTC stats */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), this.config.pollIntervalMs);
  }

  /** Stop polling */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pin to a specific layer, bypassing automatic selection */
  forceLayer(layer: QualityLayer): void {
    this.forcedLayer = layer;
    this.applyLayer(layer);
  }

  /** Resume automatic layer selection */
  releaseForce(): void {
    this.forcedLayer = null;
  }

  /** Current active layer */
  get currentLayer(): QualityLayer {
    return this.layer;
  }

  /** Compute the desired layer based on network conditions */
  computeLayer(lossPercent: number, rttMs: number): QualityLayer {
    let target = this.layer;

    const shouldStepDown =
      lossPercent > this.config.lossThresholdDown ||
      rttMs > this.config.rttThresholdDown;

    const shouldStepUp =
      lossPercent < this.config.lossThresholdUp &&
      rttMs < this.config.rttThresholdUp;

    if (shouldStepDown && target > 0) {
      target = (target - 1) as QualityLayer;
    } else if (shouldStepUp && target < 2) {
      target = (target + 1) as QualityLayer;
    }

    return target;
  }

  private async poll(): Promise<void> {
    if (this.forcedLayer !== null) return;

    try {
      const stats = await this.pc.getStats();
      let lossPercent = 0;
      let rttMs = 0;

      stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const lost = report.packetsLost ?? 0;
          const received = report.packetsReceived ?? 0;
          const total = lost + received;
          lossPercent = total > 0 ? (lost / total) * 100 : 0;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rttMs = (report.currentRoundTripTime ?? 0) * 1000;
        }
      });

      const desired = this.computeLayer(lossPercent, rttMs);
      if (desired !== this.layer) {
        this.applyLayer(desired);
      }
    } catch {
      // Stats unavailable — no-op
    }
  }

  private applyLayer(layer: QualityLayer): void {
    this.layer = layer;
    this.onLayerChange?.(layer);
  }
}
