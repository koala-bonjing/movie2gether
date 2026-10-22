// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Ensure WebView2 media permissions (camera, microphone) and autoplay policies work without friction,
  // and prune any stale Service Worker cache left from legacy PWA bundles.
  #[cfg(windows)]
  {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      let sw_path = std::path::Path::new(&local_app_data)
        .join("app.duet.watch")
        .join("EBWebView")
        .join("Default")
        .join("Service Worker");
      if sw_path.exists() {
        let _ = std::fs::remove_dir_all(&sw_path);
      }
    }

    let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    let media_args = "--enable-features=msEdgePermissionPrompt --autoplay-policy=no-user-gesture-required --disable-features=msEdgeServiceWorkerCache,ServiceWorker --disable-http-cache";
    let combined = if current_args.is_empty() {
      media_args.to_string()
    } else {
      format!("{} {}", current_args, media_args)
    };
    // SAFETY: Called single-threaded at process startup before initializing webview runtime
    unsafe {
      std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
    }
  }

  app_lib::run();
}
