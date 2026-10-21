# Duet — Shipping & Distribution Guide

Duet is built as a static Single Page Application (SPA) in `dist/` that runs everywhere:
1. **Web & PWA** (Desktop & Mobile browsers)
2. **Android** (Native APK via Capacitor)
3. **Windows** (Standalone portable `.exe` via Tauri 2 — no installer required)

---

## 1. Prerequisites & Environment Setup

Duplicate `.env.example` to `.env` and fill in your Supabase project credentials and WebRTC STUN/TURN servers:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USER=
VITE_TURN_CRED=
```

> **Security Note:** Only public anonymous keys and public STUN/TURN values are baked into the client bundle at build time. Never commit `.env` or service role keys.

---

## 2. Web & Progressive Web App (PWA)

### Why HTTPS is Required
WebRTC (`getUserMedia`, `RTCPeerConnection`), Screen Share (`getDisplayMedia`), and `crypto.subtle` (fingerprinting) strictly require a **Secure Context** (`https://` or `http://localhost`).

### Production Web Build
```bash
pnpm build
```
The output is written to `dist/`, including:
- Pre-cached static application assets (`.js`, `.css`, SVG/PNG icons)
- Service Worker: `dist/sw.js` and `dist/registerSW.js`
- Web Manifest: `dist/manifest.webmanifest`

### Deployment Options
Deploy the `dist/` folder to any static hosting provider configured for SPAs (redirect all paths to `/index.html`):
- **Cloudflare Pages:** Build command `pnpm build`, Output directory `dist`
- **Vercel:** Framework Preset `Vite`, Output directory `dist`
- **Netlify:** Build command `pnpm build`, Publish directory `dist`

### Installing the PWA
- **Desktop Chrome / Edge / Brave:** Click the install icon in the address bar or the in-app "Install Duet" prompt.
- **Android Chrome:** Tap the "Install Duet" prompt at the bottom of the screen or open the menu (⋮) and tap **Install app**.
- **iOS Safari (Add to Home Screen):**
  1. Open the deployed Duet HTTPS URL in Safari.
  2. Tap the **Share** button (box with upward arrow) in the toolbar.
  3. Scroll down and tap **Add to Home Screen**.
  4. Tap **Add** in the top right.
  5. Launch Duet from your home screen for fullscreen standalone viewing without browser chrome.

---

## 3. Android APK (Capacitor)

Duet wraps the web application using Capacitor for native Android deployment.

### Android Permissions
Configured in `android/app/src/main/AndroidManifest.xml`:
- `android.permission.INTERNET` — Supabase Realtime signaling and WebRTC media
- `android.permission.CAMERA` — Video call camera stream
- `android.permission.RECORD_AUDIO` — Voice chat microphone stream
- `android.permission.MODIFY_AUDIO_SETTINGS` — Speakerphone/headphone audio routing
- `android.permission.WAKE_LOCK` — Screen keep-awake during playback

### Building the Debug APK
1. Build the web app and sync native assets:
   ```bash
   pnpm cap:sync
   ```
2. Build the debug APK using Gradle:
   ```bash
   cd android
   ./gradlew assembleDebug
   # On Windows PowerShell:
   # .\gradlew.bat assembleDebug
   ```
3. Artifact Location:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Sideloading onto an Android Device
1. Enable **Developer Options** and **USB Debugging** (or "Install Unknown Apps") on your Android phone.
2. Transfer `app-debug.apk` to your phone via USB, email, or `adb install`:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. Open Duet on your phone, grant Camera and Microphone permissions when joining a call, and pick any MP4 video from local storage.

---

## 4. Windows Portable Executable (Tauri 2 — No Installer)

Duet builds into a lightweight, standalone Windows `.exe` utilizing the system's built-in Microsoft Edge WebView2 runtime (pre-installed on Windows 11 and current Windows 10).

### Key Features
- **Zero installer:** Single double-click executable.
- **Window configuration:** Defaults to 1200×800 with 900×600 minimum size, dark background `#0F0D12` to prevent white flash.
- **Hardware acceleration:** Native Direct3D 11 / DXVA video decoding via WebView2.
- **Desktop Screen Sharing:** Full `getDisplayMedia` support.

### Building the Portable Exe
Run the Tauri build command without bundle generation:
```bash
pnpm tauri build --no-bundle
```

### Artifact Location
```
src-tauri/target/release/duet.exe
```

### Windows SmartScreen Bypass Instructions
Because the portable `.exe` is self-signed/unsigned:
1. When double-clicking `duet.exe` for the first time, Windows Defender SmartScreen may display:
   > *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
2. Click **More info**.
3. Click the **Run anyway** button.
4. Duet starts immediately and will not prompt again on that machine.

---

## 5. Media Codec Best Practices

While Duet supports browser-compatible formats, hardware support varies across platforms:
- **Universal compatibility:** MP4 container with **H.264 video** (AVC) and **AAC audio**.
- **MKV / HEVC files:** While Windows WebView2 and desktop Chrome may decode MKV if local codecs are present, mobile devices and Safari will not.
- **Remuxing without re-encoding:**
  To quickly convert an MKV to an MP4 container in 2 seconds with zero quality loss:
  ```bash
  ffmpeg -i input.mkv -c copy output.mp4
  ```
- **Transcoding incompatible codecs (HEVC / AC3 / DTS):**
  ```bash
  ffmpeg -i input.mkv -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k output.mp4
  ```
