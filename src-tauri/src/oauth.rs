// 구글 로그인용 로컬 콜백: 브라우저가 로그인을 마치고 http://127.0.0.1:41729/callback?code=... 로 돌아오면
// 그 한 번의 요청을 받아 쿼리 문자열을 앱(TS)에 넘긴다. 표준 라이브러리만 쓴다(새 의존성 없음).
// 127.0.0.1에만 열고, 최대 3분, 한 번에 하나만 대기한다.
use std::{
    io::{ErrorKind, Read, Write},
    net::{TcpListener, TcpStream},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

pub const PORT: u16 = 41729;
pub const TIMEOUT: Duration = Duration::from_secs(180);

/// 대기 중인지 / 취소 요청이 왔는지
pub static ACTIVE: AtomicBool = AtomicBool::new(false);
pub static CANCEL: AtomicBool = AtomicBool::new(false);

const PAGE: &str = "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>개릿</title></head>\
<body style=\"font-family:system-ui,sans-serif;text-align:center;padding:56px 16px;color:#34304f\">\
<h2>로그인이 끝났어요</h2><p>이 탭을 닫고 개릿으로 돌아가세요.</p></body></html>";

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let msg = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(msg.as_bytes());
}

/// "GET /callback?code=abc&state=x HTTP/1.1" → Some("code=abc&state=x")
pub fn callback_query(request_line: &str) -> Option<String> {
    let target = request_line.split_whitespace().nth(1)?;
    target.strip_prefix("/callback?").map(|q| q.to_string())
}

/// 콜백 요청이 올 때까지(또는 시간 초과·취소까지) 기다린다. 다른 요청(파비콘 등)은 404로 돌려보낸다.
pub fn wait_for_callback(listener: &TcpListener, timeout: Duration) -> Option<String> {
    let _ = listener.set_nonblocking(true);
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline && !CANCEL.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                match callback_query(request.lines().next().unwrap_or("")) {
                    Some(query) => {
                        respond(&mut stream, "200 OK", PAGE);
                        return Some(query);
                    }
                    None => respond(&mut stream, "404 Not Found", ""),
                }
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(100)),
            Err(_) => break,
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_callback_line() {
        assert_eq!(callback_query("GET /callback?code=abc&state=x HTTP/1.1").as_deref(), Some("code=abc&state=x"));
        assert_eq!(callback_query("GET /favicon.ico HTTP/1.1"), None);
        assert_eq!(callback_query("GET /callback HTTP/1.1"), None);
        assert_eq!(callback_query(""), None);
    }

    #[test]
    fn receives_the_callback_and_ignores_other_requests() {
        CANCEL.store(false, Ordering::Relaxed);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let client = thread::spawn(move || {
            for line in ["GET /favicon.ico HTTP/1.1\r\n\r\n", "GET /callback?code=hello&state=s1 HTTP/1.1\r\nHost: x\r\n\r\n"] {
                let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
                s.write_all(line.as_bytes()).unwrap();
                let mut reply = String::new();
                s.read_to_string(&mut reply).unwrap();
                if line.contains("/callback") {
                    assert!(reply.starts_with("HTTP/1.1 200"));
                } else {
                    assert!(reply.starts_with("HTTP/1.1 404"));
                }
            }
        });
        let got = wait_for_callback(&listener, Duration::from_secs(5));
        client.join().unwrap();
        assert_eq!(got.as_deref(), Some("code=hello&state=s1"));
    }

    #[test]
    fn times_out_without_a_request() {
        CANCEL.store(false, Ordering::Relaxed);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        assert_eq!(wait_for_callback(&listener, Duration::from_millis(300)), None);
    }
}
