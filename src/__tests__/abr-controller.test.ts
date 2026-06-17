import { ABRController } from '../abr-controller';
import type { QualityLayer } from '../types';

function mockPC(): any {
  const listeners: Record<string, () => void> = {};
  return {
    iceGatheringState: 'complete',
    iceConnectionState: 'connected',
    addEventListener: (event: string, fn: () => void) => {
      listeners[event] = fn;
    },
    getStats: jest.fn().mockResolvedValue(new Map()),
    _trigger: (event: string) => listeners[event]?.(),
  };
}

describe('ABRController', () => {
  it('starts at layer 2 (high)', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    expect(abr.currentLayer).toBe(2);
  });

  it('steps down when loss is high', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    const layer = abr.computeLayer(10, 50); // loss 10% > threshold 5%
    expect(layer).toBe(1);
  });

  it('stays at 0 when already at minimum and conditions are bad', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    abr.forceLayer(0);
    const layer = abr.computeLayer(20, 500);
    expect(layer).toBe(0);
  });

  it('steps up when conditions are excellent', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    abr.forceLayer(0);
    abr.releaseForce();
    // After forceLayer(0), this.layer = 0; one computeLayer step up → 1
    const layer = abr.computeLayer(0, 100); // both under up-thresholds
    expect(layer).toBe(1);
  });

  it('respects forced layer and does not auto-adjust', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    abr.forceLayer(1);
    expect(abr.currentLayer).toBe(1);
  });

  it('calls onLayerChange when layer changes via forceLayer', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    const changes: QualityLayer[] = [];
    abr.onLayerChange = (l) => changes.push(l);
    abr.forceLayer(0);
    abr.forceLayer(2);
    expect(changes).toEqual([0, 2]);
  });

  it('does not step beyond max layer 2', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    // Already at 2, excellent conditions
    const layer = abr.computeLayer(0, 50);
    expect(layer).toBe(2);
  });

  it('starts and stops polling without error', () => {
    const pc = mockPC();
    const abr = new ABRController(pc, { pollIntervalMs: 50 });
    abr.start();
    abr.stop();
  });

  it('uses custom thresholds', () => {
    const pc = mockPC();
    const abr = new ABRController(pc, {
      lossThresholdDown: 20,
      rttThresholdDown: 500,
    });
    // Loss 10% < custom threshold 20% — should not step down
    const layer = abr.computeLayer(10, 100);
    expect(layer).toBe(2);
  });

  it('releases forced layer', () => {
    const pc = mockPC();
    const abr = new ABRController(pc);
    abr.forceLayer(0);
    abr.releaseForce();
    // After release, auto-selection resumes — currentLayer still 0 until next poll
    expect(abr.currentLayer).toBe(0);
  });
});
