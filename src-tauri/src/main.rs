#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod oauth;

use std::{
    net::TcpListener,
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_window_state::StateFlags;

// 사용자가 동의하면 켜고, 거부하거나 끄면 프로그램 이름을 아예 읽지 않는다
#[tauri::command]
fn set_app_detection(enabled: bool) {
    activity::set_app_detection(enabled);
}

// 정리(방 나가기/닫기)가 끝나면 TS가 부른다
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ── 구글 로그인 ─────────────────────────────────
// 1) oauth_listen: 127.0.0.1:41729에서 콜백을 기다리기 시작(쿼리가 오면 "oauth-callback" 이벤트로 전달, 빈 문자열 = 시간 초과·취소)
// 2) open_external: 시스템 브라우저로 로그인 주소를 연다(https만)
#[tauri::command]
fn oauth_listen(app: AppHandle) -> Result<(), String> {
    if oauth::ACTIVE.swap(true, Ordering::SeqCst) {
        return Err("이미 로그인 대기 중이에요.".into());
    }
    oauth::CANCEL.store(false, Ordering::SeqCst);
    let listener = match TcpListener::bind(("127.0.0.1", oauth::PORT)) {
        Ok(l) => l,
        Err(e) => {
            oauth::ACTIVE.store(false, Ordering::SeqCst);
            return Err(format!("로그인용 포트({})를 열 수 없어요: {e}", oauth::PORT));
        }
    };
    thread::spawn(move || {
        let query = oauth::wait_for_callback(&listener, oauth::TIMEOUT).unwrap_or_default();
        drop(listener);
        oauth::ACTIVE.store(false, Ordering::SeqCst);
        let _ = app.emit("oauth-callback", query);
    });
    Ok(())
}

#[tauri::command]
fn oauth_cancel() {
    oauth::CANCEL.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("https 주소만 열 수 있어요.".into());
    }
    #[cfg(target_os = "macos")]
    let spawned = Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "windows")]
    let spawned = Command::new("rundll32").args(["url.dll,FileProtocolHandler", url.as_str()]).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let spawned = Command::new("xdg-open").arg(&url).spawn();
    spawned.map(|_| ()).map_err(|e| e.to_string())
}

static QUITTING: AtomicBool = AtomicBool::new(false);

// 종료 요청(창 닫기·Cmd+Q)을 바로 받아들이지 않고, 앱이 방에서 나가는 정리를 하도록 알린 뒤 종료한다.
// 앱이 응답하지 않아도 2.5초 뒤에는 반드시 종료한다.
fn request_quit(app: &AppHandle) {
    if QUITTING.swap(true, Ordering::SeqCst) {
        return; // 이미 정리 중
    }
    let _ = app.emit_to("main", "quit-requested", ());
    let handle = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(2500));
        handle.exit(0);
    });
}

fn main() {
    tauri::Builder::default()
        // 위치·크기만 저장. 테두리 등은 모드에 따라 TS가 정한다.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .with_denylist(&["chat", "shop"]) // 보조 창은 항상 정해 둔 크기로 연다
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![set_app_detection, quit_app, oauth_listen, oauth_cancel, open_external])
        // 메인 창을 닫으면 앱 종료 (채팅·상점 창도 함께 닫힘)
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    request_quit(window.app_handle());
                }
            }
        })
        // 2초마다 원시 활동 신호를 로컬 이벤트로 전달
        .setup(|app| {
            let handle = app.handle().clone();
            thread::spawn(move || loop {
                let sample = activity::sample();
                #[cfg(debug_assertions)]
                println!(
                    "[activity] idle={:.1}s app={:?} kind={:?}",
                    sample.idle_seconds, sample.app_id, sample.input_kind
                );
                let _ = handle.emit("activity", sample);
                thread::sleep(Duration::from_secs(2));
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Cmd+Q 등 사용자의 종료 요청 (code가 있으면 앱 코드가 직접 낸 종료이므로 막지 않는다)
            if let RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                    request_quit(app);
                }
            }
        });
}
