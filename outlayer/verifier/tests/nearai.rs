//! Regression for the live E_NO_RESULT on a real booking.com confirmation: Qwen3.8 reasons by default, spent all
//! max_tokens thinking and returned no content (and took 45 s). The request must switch thinking off.
use dibs_verifier::http::Http;
use dibs_verifier::nearai::{Extractor, NearAi};
use serde_json::{json, Value};
use std::cell::RefCell;

struct Canned {
    reply: Value,
    seen: RefCell<Option<Value>>,
}
impl Http for Canned {
    fn get(&self, _: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        Err("no signature in this test".into())
    }
    fn post(&self, _: &str, _: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        *self.seen.borrow_mut() = Some(serde_json::from_slice(body).unwrap());
        Ok(self.reply.to_string().into_bytes())
    }
}

fn ai(h: &Canned) -> NearAi<'_> {
    NearAi { http: h, api_key: "k".into(), base: "https://x.invalid".into() }
}

#[test]
fn request_disables_thinking_and_caps_input() {
    let facts = r#"{"stay":"Harbour View Hotel Singapore","check_in":"2026-01-10","check_out":"2026-01-11","guests":2,"total":"226.60","currency":"SGD","booking_ref":"1234567890"}"#;
    let h = Canned { reply: json!({"id":"c1","choices":[{"finish_reason":"stop","message":{"content":facts}}]}), seen: RefCell::new(None) };
    let long = "Confirmation 1234567890 total 226.60 SGD ".repeat(1000);
    let out = ai(&h).extract(&long).unwrap();
    assert_eq!(out.facts.total, "226.60");
    let req = h.seen.borrow().clone().unwrap();
    assert_eq!(req["chat_template_kwargs"]["enable_thinking"], json!(false));
    assert!(req["messages"][1]["content"].as_str().unwrap().chars().count() <= 12_000);
}

#[test]
fn reasoning_only_reply_without_content_is_an_extract_error() {
    let reply = json!({"id":"c2","choices":[{"finish_reason":"length","message":{"content":null,"reasoning_content":"thinking..."}}]});
    let h = Canned { reply, seen: RefCell::new(None) };
    assert!(ai(&h).extract("x").err().unwrap().contains("no content"));
}
