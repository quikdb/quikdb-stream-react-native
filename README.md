# @quikdb/stream-react-native

React Native SDK for [QuikDB Stream](https://stream.quikdb.com) — managed live streaming infrastructure with sub-500ms stream switching for scroll-feed apps.

Built on `react-native-webrtc` (WHEP/WHIP), mirrors the `@quikdb/stream-web` API.

## Installation

```sh
npm install @quikdb/stream-react-native react-native-webrtc
# or
yarn add @quikdb/stream-react-native react-native-webrtc
```

Configure the registry in `.npmrc`:

```
@quikdb:registry=https://npm.pkg.github.com
```

### iOS

```sh
cd ios && pod install
```

Add camera/microphone permissions to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera for live streaming</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone for live streaming</string>
```

### Android

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Quick Start

### Watch a stream

```tsx
import { QuikDBStream } from '@quikdb/stream-react-native';
import { RTCView } from 'react-native-webrtc';

const sdk = QuikDBStream.init({ apiKey: 'qs_live_xxx' });

const { session } = await sdk.play({ room: 'room-id' });

// Attach to RTCView
<RTCView streamURL={session.stream.toURL()} style={{ flex: 1 }} />
```

### Scroll feed (instant switching)

```tsx
const feed = await sdk.createFeed({
  streams: ['room-1', 'room-2', 'room-3'],
  prefetch: 1, // pre-connect 1 adjacent stream each direction
});

// Switch to first stream
const session = await feed.switchTo(0);

// Swipe down → next
const next = await feed.next();

// Swipe up → previous
const prev = await feed.previous();

// Cleanup
feed.destroy();
```

### Broadcast (go live)

```tsx
const session = await sdk.broadcast({
  room: 'my-room',
  simulcast: true, // low/mid/high quality layers
});

// Show local preview
<RTCView streamURL={session.stream.toURL()} mirror style={{ flex: 1 }} />

// Stop broadcasting
session.close();
```

## API

### `QuikDBStream`

```ts
QuikDBStream.init(config: StreamConfig): QuikDBStream
```

| Field | Type | Default |
|---|---|---|
| `apiKey` | `string` | required |
| `serverUrl` | `string` | `https://stream.quikdb.com` |
| `iceServers` | `RTCIceServer[]` | SFU defaults |

---

### `.play(options)`

Watch a single stream with ABR and auto-reconnect.

```ts
const { session, abr, reconnect } = await sdk.play({
  room: 'room-id',
}, (event) => console.log(event));
```

Returns `{ session: WHEPSession, abr: ABRController, reconnect: ReconnectHandler }`.

---

### `.createFeed(options)`

Create a scroll-feed with instant switching (<100ms via WHEP pre-subscribe).

```ts
const feed = await sdk.createFeed({
  streams: string[],
  prefetch?: number, // default: 1
}, onEvent?);
```

Returns `FeedController`.

| Method | Description |
|---|---|
| `switchTo(index)` | Switch to stream at index |
| `next()` | Next stream |
| `previous()` | Previous stream |
| `destroy()` | Close all connections |
| `currentRoom` | Active room ID |
| `length` | Total streams |

---

### `.broadcast(options)`

Go live from device camera/mic.

```ts
const session = await sdk.broadcast({
  room: 'room-id',
  simulcast?: boolean, // default: true
  video?: boolean | VideoConstraints,
  audio?: boolean,
});
```

Returns `WHIPSession` — `{ pc, stream, close }`.

---

### `ABRController`

Monitors WebRTC stats and automatically selects the quality layer.

```ts
abr.forceLayer(0 | 1 | 2);   // pin to low/mid/high
abr.releaseForce();           // resume auto-selection
abr.currentLayer;             // current layer
abr.onLayerChange = (layer) => { ... };
```

---

### `ReconnectHandler`

Handles ICE disconnections with exponential backoff.

```ts
reconnect.onEvent((event) => {
  if (event.type === 'reconnecting') showSpinner();
  if (event.type === 'reconnected') hideSpinner();
  if (event.type === 'error') showError();
});

reconnect.abort(); // cancel reconnection
```

## Events

All event callbacks receive a `StreamEvent`:

| `type` | When |
|---|---|
| `switched` | Feed switched to a new stream |
| `streamActive` | Publisher connected |
| `streamEnded` | Publisher disconnected |
| `viewerCount` | Viewer count update |
| `qualityChange` | ABR changed quality layer |
| `reconnecting` | ICE reconnect started |
| `reconnected` | ICE reconnect succeeded |
| `error` | Unrecoverable error |

## Architecture

```
QuikDBStream
  ├── StreamClient       HTTP control API
  ├── WHEPClient         Viewer WebRTC (subscribe / pre-subscribe / activate)
  ├── WHIPClient         Publisher WebRTC (simulcast ingest)
  ├── FeedController     Scroll-feed with instant switching
  │   └── PrefetchManager  Sliding window of pre-subscribe connections
  ├── ABRController      Automatic quality adaptation
  └── ReconnectHandler   ICE restart + full reconnect
```

**Pre-subscribe protocol** — the key to <100ms switching:

1. `FeedController` keeps ±N rooms pre-connected at keyframe-only bandwidth (FREE)
2. On scroll → `activate()` promotes the pre-connection to full subscriber
3. If not pre-connected → cold `subscribe()` fallback

## Pricing

| Plan | Monthly | Included |
|---|---|---|
| Free | $0 | 5,000 viewer-minutes |
| Starter | $29 | 100,000 viewer-minutes |
| Growth | $149 | 1,000,000 viewer-minutes |
| Scale | Custom | Unlimited |

Pre-subscribe connections are **free** and don't count toward billing.

## License

MIT — © QuikDB Inc.
