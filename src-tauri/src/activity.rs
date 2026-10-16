// 원시 신호만 만든다. 상태 판정은 TS(activity/)에서.
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawActivity {
    pub idle_seconds: f64,
    pub app_id: Option<String>,
    // 가장 최근 입력이 키보드였는지 마우스·타블렛이었는지. 오래됐거나 알 수 없으면 None.
    pub input_kind: Option<&'static str>,
}

// 이보다 오래된 입력은 종류를 알려주지 않는다
const KIND_MAX_AGE_SECONDS: f64 = 60.0;

// 프로그램 이름 읽기는 사용자가 허락하기 전까지 꺼져 있다 (앱 시작 시 기본 false).
// TS가 동의 결과에 따라 set_app_detection으로 켜고 끈다. 꺼져 있으면 활성 프로그램 조회 자체를 하지 않는다.
static APP_DETECTION: AtomicBool = AtomicBool::new(false);

pub fn set_app_detection(enabled: bool) {
    APP_DETECTION.store(enabled, Ordering::Relaxed);
}

pub fn sample() -> RawActivity {
    let (key_idle, pointer_idle) = platform::input_idle();
    let input_kind = if key_idle.min(pointer_idle) > KIND_MAX_AGE_SECONDS {
        None
    } else if key_idle <= pointer_idle {
        Some("keyboard")
    } else {
        Some("pointer")
    };
    RawActivity {
        idle_seconds: platform::idle_seconds(),
        app_id: if APP_DETECTION.load(Ordering::Relaxed) { platform::active_app() } else { None },
        input_kind,
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
    }

    pub fn idle_seconds() -> f64 {
        // 1 = HID system state, u32::MAX = 모든 이벤트 종류
        unsafe { CGEventSourceSecondsSinceLastEventType(1, u32::MAX) }
    }

    fn seconds_since(event_type: u32) -> f64 {
        unsafe { CGEventSourceSecondsSinceLastEventType(1, event_type) }
    }

    // (키보드, 마우스·타블렛) 각각 마지막 입력 이후 초. 어떤 키인지는 읽지 않는다.
    pub fn input_idle() -> (f64, f64) {
        const KEY_DOWN: u32 = 10;
        // 마우스 버튼, 이동, 드래그, 스크롤, 타블렛 펜
        const POINTER: [u32; 10] = [1, 3, 5, 6, 7, 22, 23, 24, 25, 27];
        let pointer = POINTER.iter().map(|&t| seconds_since(t)).fold(f64::MAX, f64::min);
        (seconds_since(KEY_DOWN), pointer)
    }

    // lsappinfo는 별도 권한 없이 최전면 앱 정보를 돌려준다.
    // 일부 환경에서는 이름이 `[ NULL ]`로 오므로, 이름 → 번들 이름 → 프로세스 실행 파일 이름 순으로 시도한다.
    fn lsappinfo(args: &[&str]) -> Option<String> {
        let out = Command::new("lsappinfo").args(args).output().ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        // "LSDisplayName"="Google Chrome"  /  "LSDisplayName"=[ NULL ]
        let value = text.split_once('=')?.1.trim().trim_matches('"').trim().to_string();
        let blank = value.is_empty() || value.contains("NULL") || value.starts_with('[');
        (!blank).then_some(value)
    }

    // 1순위: NSWorkspace (권한 불필요, 이름이 비는 경우가 거의 없음)
    fn workspace_app() -> Option<String> {
        use objc2_app_kit::NSWorkspace;
        let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
        let name = app.localizedName().map(|n| n.to_string());
        let name = name.filter(|n| !n.trim().is_empty()).or_else(|| {
            // 이름이 없으면 실행 파일 이름
            app.executableURL()?.lastPathComponent().map(|n| n.to_string())
        })?;
        (!name.trim().is_empty()).then_some(name)
    }

    pub fn active_app() -> Option<String> {
        workspace_app().or_else(lsappinfo_app)
    }

    // 2순위: lsappinfo
    fn lsappinfo_app() -> Option<String> {
        let front = Command::new("lsappinfo").arg("front").output().ok()?;
        let asn = String::from_utf8_lossy(&front.stdout).trim().to_string();
        if asn.is_empty() || asn.contains("NULL") {
            return None;
        }
        for key in ["name", "bundlename"] {
            if let Some(name) = lsappinfo(&["info", "-only", key, &asn]) {
                return Some(name);
            }
        }
        // 마지막 수단: pid → 실행 파일 이름 (예: /Applications/Foo.app/Contents/MacOS/Foo → Foo)
        let pid = lsappinfo(&["info", "-only", "pid", &asn])?;
        let ps = Command::new("ps").args(["-p", &pid, "-o", "comm="]).output().ok()?;
        let path = String::from_utf8_lossy(&ps.stdout).trim().to_string();
        let name = path.rsplit('/').next()?.to_string();
        (!name.is_empty()).then_some(name)
    }
}

#[cfg(windows)]
mod platform {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Once;
    use windows_sys::Win32::Foundation::{CloseHandle, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::SystemInformation::{GetTickCount, GetTickCount64};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId,
        SetWindowsHookExW, MSG, WH_KEYBOARD_LL, WH_MOUSE_LL,
    };

    // 마지막 키보드·마우스 입력의 시각(GetTickCount64, ms). 0 = 아직 없음.
    // 훅은 "입력이 있었다"는 시각만 기록한다. 어떤 키인지, 무엇을 입력했는지는 읽지 않는다.
    static LAST_KEY: AtomicU64 = AtomicU64::new(0);
    static LAST_POINTER: AtomicU64 = AtomicU64::new(0);
    static HOOKS: Once = Once::new();

    unsafe extern "system" fn on_key(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            LAST_KEY.store(GetTickCount64(), Ordering::Relaxed);
        }
        CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
    }

    unsafe extern "system" fn on_pointer(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            LAST_POINTER.store(GetTickCount64(), Ordering::Relaxed);
        }
        CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
    }

    // 저수준 훅은 메시지 루프가 있는 스레드에서 돌아야 한다. 처음 한 번만 만든다.
    fn ensure_hooks() {
        HOOKS.call_once(|| {
            std::thread::spawn(|| unsafe {
                let module = GetModuleHandleW(std::ptr::null());
                SetWindowsHookExW(WH_KEYBOARD_LL, Some(on_key), module, 0);
                SetWindowsHookExW(WH_MOUSE_LL, Some(on_pointer), module, 0);
                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}
            });
        });
    }

    pub fn input_idle() -> (f64, f64) {
        ensure_hooks();
        let now = unsafe { GetTickCount64() };
        let since = |last: u64| {
            if last == 0 {
                f64::MAX
            } else {
                now.saturating_sub(last) as f64 / 1000.0
            }
        };
        (
            since(LAST_KEY.load(Ordering::Relaxed)),
            since(LAST_POINTER.load(Ordering::Relaxed)),
        )
    }

    pub fn idle_seconds() -> f64 {
        unsafe {
            let mut info = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut info) == 0 {
                return 0.0;
            }
            GetTickCount().wrapping_sub(info.dwTime) as f64 / 1000.0
        }
    }

    // 실행 파일 이름(예: chrome.exe)
    pub fn active_app() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process.is_null() {
                return None;
            }
            let mut buf = [0u16; 512];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(process);
            if ok == 0 {
                return None;
            }
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            path.rsplit('\\').next().map(|s| s.to_string())
        }
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
mod platform {
    pub fn idle_seconds() -> f64 {
        0.0
    }
    pub fn input_idle() -> (f64, f64) {
        (f64::MAX, f64::MAX)
    }
    pub fn active_app() -> Option<String> {
        None
    }
}
