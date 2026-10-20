---
name: cross-platform-packaging
description: Shipping Duet's single web build as a PWA, Android APK (Capacitor), and a portable Windows exe (Tauri 2, no installer). Use for Phase 8 and any native-wrapper bug.
---

# cross-platform-packaging

## Mental model
The web build in `dist/` is the product. Each platform is a different **window** around the same files. Keep the app a static SPA so every wrapper can load it.

## PWA
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`; manifest: name, short_name, `display: 'standalone'`, theme/background from `DESIGN.md`, icons 192/512 + maskable.
- Cache the app shell only. Never cache video or realtime traffic.
- iOS: Share → Add to Home Screen. Document it in `docs/SHIPPING.md`.

## Android (Capacitor)
```
pnpm add @capacitor/core @capacitor/android @capacitor-community/keep-awake
pnpm add -D @capacitor/cli
npx cap init Duet app.duet.watch --web-dir=dist
npx cap add android
pnpm build && npx cap sync android
npx cap open android
```
- AndroidManifest: `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`.
- Verify on a **real device**: camera/mic prompt, `<input type=file>` + `createObjectURL` playback, fullscreen/landscape, keep-awake while playing.
- Output: `android/app/build/outputs/apk/debug/app-debug.apk` → sideload.
- Phones struggle with MKV/HEVC: standardize on MP4 H.264/AAC.

## Windows portable exe (Tauri 2) — no installer
```
pnpm add -D @tauri-apps/cli
pnpm tauri init        # frontendDist: ../dist, devUrl: http://localhost:5173
pnpm tauri build --no-bundle
# → src-tauri/target/release/duet.exe  (double-click to run)
```
- Uses system WebView2 (preinstalled on Windows 11 and current Windows 10).
- Set window defaults in `tauri.conf.json` (min 900x600, title "Duet", dark background to avoid white flash).
- Ensure camera/mic permission prompt works in WebView2; test screen share (`getDisplayMedia`).
- The exe is unsigned: Windows SmartScreen shows a warning once. Document "More info → Run anyway".
- No auto-update: to ship a change, rebuild and resend the exe.
- Optional later: add an NSIS installer only if explicitly asked.

## Shared checklist
- [ ] HTTPS origin for web (camera/mic need a secure context).
- [ ] Env values baked at build time; no secrets beyond the public anon key.
- [ ] Back button / window close leaves the room cleanly.
- [ ] Safe-area insets and orientation verified on device.
- [ ] `docs/SHIPPING.md` updated with exact commands and artifact paths.
- [ ] No keystores, certificates, or `.env` committed.
