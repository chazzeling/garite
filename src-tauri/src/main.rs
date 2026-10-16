#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;

use std::{
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
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![set_app_detection, quit_app])
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
