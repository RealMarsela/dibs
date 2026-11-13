use near_sdk::serde::de::DeserializeOwned;
use near_sdk::{env, serde_json, AccountId, PromiseResult};

pub fn code_ok(c: &str) -> bool {
    (3..=12).contains(&c.len()) && c.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

pub fn date_ok(d: &str) -> bool {
    d.len() == 10
        && d.bytes().enumerate().all(|(i, b)| if i == 4 || i == 7 { b == b'-' } else { b.is_ascii_digit() })
}

pub fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let b = s.as_bytes();
    if b.len() % 2 != 0 {
        return None;
    }
    let nib = |c: u8| match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    };
    let mut out = Vec::with_capacity(b.len() / 2);
    for p in b.chunks(2) {
        out.push(nib(p[0])? << 4 | nib(p[1])?);
    }
    Some(out)
}

pub fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|c| c.is_ascii_hexdigit())
}

/// `b|wNN-<trip>.<dibs>`.
pub fn slot_id(kind: char, n: u8, trip: &str) -> AccountId {
    let mut s = String::with_capacity(48);
    s.push(kind);
    s.push((b'0' + n / 10) as char);
    s.push((b'0' + n % 10) as char);
    s.push('-');
    s.push_str(trip);
    s.push('.');
    s.push_str(env::current_account_id().as_str());
    AccountId::try_from(s).unwrap_or_else(|_| env::panic_str("E_BAD_ARGS"))
}

pub fn fail(code: &str) -> ! {
    env::panic_str(code)
}

pub fn ensure(cond: bool, code: &str) {
    if !cond {
        env::panic_str(code)
    }
}

pub fn require_self() {
    ensure(env::predecessor_account_id() == env::current_account_id(), "E_PRIVATE");
}

pub fn log_event(event: &str, trip: &str, code: &str) {
    env::log_str(&["EVENT_JSON:{\"event\":\"", event, "\",\"trip\":\"", trip, "\",\"code\":\"", code, "\"}"].concat());
}

/// The first promise result as JSON; `None` when the promise failed or the value does not parse.
pub fn promise_json<T: DeserializeOwned>() -> Option<T> {
    match env::promise_result(0) {
        PromiseResult::Successful(b) => serde_json::from_slice(&b).ok(),
        _ => None,
    }
}
