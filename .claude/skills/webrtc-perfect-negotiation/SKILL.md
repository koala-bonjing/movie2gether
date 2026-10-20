---
name: webrtc-perfect-negotiation
description: Reliable two-peer WebRTC for Duet video chat and screen share — perfect negotiation, signaling over Supabase, TURN, quality stats. Use when writing or debugging src/features/call.
---

# webrtc-perfect-negotiation

## Mental model
WebRTC connects two browsers directly, but they must first swap "how to reach me" notes (SDP + ICE candidates) through a third party. Supabase broadcast is that mailbox. **Perfect negotiation** makes both sides able to start a call at the same time without breaking.

## Skeleton
```ts
const polite = myId < peerId;
let makingOffer = false, ignoreOffer = false;

pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true;
    await pc.setLocalDescription();            // creates offer implicitly
    signal({ type: 'description', description: pc.localDescription! });
  } finally { makingOffer = false; }
};

pc.onicecandidate = ({ candidate }) => signal({ type: 'candidate', candidate });

async function onSignal(data: SignalData) {
  if (data.type === 'description') {
    const d = data.description;
    const collision = d.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
    ignoreOffer = !polite && collision;
    if (ignoreOffer) return;
    await pc.setRemoteDescription(d);          // polite peer rolls back implicitly
    if (d.type === 'offer') {
      await pc.setLocalDescription();
      signal({ type: 'description', description: pc.localDescription! });
    }
  } else {
    try { await pc.addIceCandidate(data.candidate); }
    catch (e) { if (!ignoreOffer) throw e; }
  }
}
```

## Config
```ts
new RTCPeerConnection({ iceServers: [
  { urls: env.STUN_URLS.split(',') },
  { urls: env.TURN_URL, username: env.TURN_USER, credential: env.TURN_CRED },
]});
```
TURN is required for ~10–20% of networks (mobile data, strict NAT). Test with `iceTransportPolicy: 'relay'` once to prove TURN works.

## Media
- Camera: 640x360 @ 24 fps; audio with echoCancellation + noiseSuppression.
- Screen share (desktop): 1920x1080 @ 30, audio true, `contentHint = 'motion'`, `maxBitrate` 6 Mbps via `sender.setParameters`.
- Use `sender.replaceTrack` to swap sources; avoid tearing down the connection.
- Stop tracks on leave: `stream.getTracks().forEach(t => t.stop())`.

## Quality badge
Every 2 s: `pc.getStats()` → `inbound-rtp` (video): `frameWidth`, `frameHeight`, `framesPerSecond`; `candidate-pair`: `availableOutgoingBitrate`. Show actual numbers; never fake "1080p".

## Recovery
On `iceconnectionstate === 'failed'` → `pc.restartIce()`. On `disconnected` wait 5 s before acting. After a channel reconnect, re-announce presence and let the polite/impolite rules re-negotiate.

## Gotchas
- HTTPS (or localhost) is mandatory for camera/mic.
- `getDisplayMedia` audio only works for Chrome/Edge *tab* sharing.
- Safari needs a user gesture for `getUserMedia` and autoplay of remote video (`playsInline`, `muted` until tap).
- Headphones fix echo better than any constraint.
