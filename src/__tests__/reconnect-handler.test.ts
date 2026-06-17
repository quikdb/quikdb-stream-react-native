import { ReconnectHandler } from '../reconnect-handler';
import type { StreamEvent } from '../types';

function mockPC() {
  const listeners: Record<string, (event?: any) => void> = {};
  return {
    iceConnectionState: 'connected',
    addEventListener: (event: string, fn: (e?: any) => void) => {
      listeners[event] = fn;
    },
    triggerICEFailure: () => {
      (mockPCRef as any).iceConnectionState = 'failed';
      listeners['iceconnectionstatechange']?.();
    },
    triggerICEDisconnect: () => {
      (mockPCRef as any).iceConnectionState = 'disconnected';
      listeners['iceconnectionstatechange']?.();
    },
  };
}

let mockPCRef: ReturnType<typeof mockPC>;

beforeEach(() => {
  jest.useFakeTimers();
  mockPCRef = mockPC();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ReconnectHandler', () => {
  it('uses default config', () => {
    const handler = new ReconnectHandler(mockPCRef as any, async () => {});
    expect((handler as any).config.maxAttempts).toBe(5);
    expect((handler as any).config.baseDelayMs).toBe(1000);
    expect((handler as any).config.maxDelayMs).toBe(30000);
  });

  it('accepts custom config', () => {
    const handler = new ReconnectHandler(mockPCRef as any, async () => {}, {
      maxAttempts: 3,
      baseDelayMs: 500,
    });
    expect((handler as any).config.maxAttempts).toBe(3);
    expect((handler as any).config.baseDelayMs).toBe(500);
  });

  it('abort() stops reconnection', () => {
    let callCount = 0;
    const handler = new ReconnectHandler(
      mockPCRef as any,
      async () => { callCount++; },
      { baseDelayMs: 100 },
    );

    handler.abort();
    mockPCRef.triggerICEFailure();
    jest.runAllTimers();

    expect(callCount).toBe(0);
  });

  it('emits reconnecting event on ICE failure', async () => {
    const events: StreamEvent[] = [];
    const handler = new ReconnectHandler(
      mockPCRef as any,
      async () => {},
      { baseDelayMs: 100 },
    );
    handler.onEvent((e) => events.push(e));

    mockPCRef.triggerICEFailure();
    jest.advanceTimersByTime(200);
    await Promise.resolve(); // flush microtasks

    expect(events.some((e) => e.type === 'reconnecting')).toBe(true);
  });

  it('reset() clears attempt counter', () => {
    const handler = new ReconnectHandler(mockPCRef as any, async () => {});
    (handler as any).attempts = 3;
    handler.reset();
    expect((handler as any).attempts).toBe(0);
  });
});
