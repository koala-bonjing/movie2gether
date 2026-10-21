// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Ensure WebView2 media permissions (camera, microphone) and autoplay policies work without friction
  #[cfg(windows)]
  {
    let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    let media_args = "--enable-features=msEdgePermissionPrompt --autoplay-policy=no-user-gesture-required";
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
