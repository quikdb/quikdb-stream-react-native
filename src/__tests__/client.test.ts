import { StreamClient } from '../client';
import { QuikDBStream } from '../quikdb-stream';

describe('StreamClient', () => {
  it('strips trailing slash from serverUrl', () => {
    const client = new StreamClient('https://stream.quikdb.com/', 'key');
    // Access private field via type cast for test only
    expect((client as any).serverUrl).toBe('https://stream.quikdb.com');
  });

  it('keeps URL without trailing slash unchanged', () => {
    const client = new StreamClient('https://stream.quikdb.com', 'key');
    expect((client as any).serverUrl).toBe('https://stream.quikdb.com');
  });

  it('stores apiKey', () => {
    const client = new StreamClient('https://stream.quikdb.com', 'qs_live_abc');
    expect((client as any).apiKey).toBe('qs_live_abc');
  });
});

describe('QuikDBStream', () => {
  it('init() throws when apiKey is missing', () => {
    expect(() => QuikDBStream.init({ apiKey: '' })).toThrow(
      'QuikDB Stream: apiKey is required',
    );
  });

  it('init() returns an instance with valid apiKey', () => {
    const sdk = QuikDBStream.init({ apiKey: 'qs_live_abc' });
    expect(sdk).toBeInstanceOf(QuikDBStream);
  });

  it('init() uses default server URL when none provided', () => {
    const sdk = QuikDBStream.init({ apiKey: 'qs_live_abc' });
    const client = (sdk as any).httpClient as StreamClient;
    expect((client as any).serverUrl).toBe('https://stream.quikdb.com');
  });

  it('init() uses custom server URL', () => {
    const sdk = QuikDBStream.init({
      apiKey: 'qs_live_abc',
      serverUrl: 'https://my-sfu.example.com',
    });
    const client = (sdk as any).httpClient as StreamClient;
    expect((client as any).serverUrl).toBe('https://my-sfu.example.com');
  });
});
