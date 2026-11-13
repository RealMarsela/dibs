//! Readable text of a verified message for the extractor. Never leaves the enclave except as the
//! model prompt; only the model's structured facts are ever signed or returned.
use crate::msg::{parse, Message};
use base64::{engine::general_purpose::STANDARD, Engine};

const MAX_CHARS: usize = 16_000;

fn param(ct: &str, key: &str) -> Option<String> {
    let lower = ct.to_ascii_lowercase();
    let at = lower.find(&format!("{key}="))? + key.len() + 1;
    let rest = &ct[at..];
    let v = if let Some(q) = rest.strip_prefix('"') { q.split('"').next()? } else { rest.split(';').next()? };
    Some(v.trim().to_string())
}

fn decode_qp(b: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'=' {
            if b.get(i + 1..i + 3) == Some(b"\r\n") {
                i += 3;
                continue;
            }
            if let Some(h) = b.get(i + 1..i + 3).and_then(|h| std::str::from_utf8(h).ok()).and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(h);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    out
}

fn strip_html(html: &str) -> String {
    let (mut out, mut in_tag) = (String::new(), false);
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    let out = out.replace("&nbsp;", " ").replace("&amp;", "&").replace("&euro;", "EUR");
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode(msg: &Message) -> Vec<u8> {
    let cte = msg.header("content-transfer-encoding").map(|h| h.value().to_ascii_lowercase()).unwrap_or_default();
    match cte.as_str() {
        "base64" => STANDARD.decode(msg.body.iter().copied().filter(|b| !b.is_ascii_whitespace()).collect::<Vec<u8>>()).unwrap_or_default(),
        "quoted-printable" => decode_qp(&msg.body),
        _ => msg.body.clone(),
    }
}

fn collect(msg: &Message, plain: &mut Vec<String>, html: &mut Vec<String>) {
    let ct = msg.header("content-type").map(|h| h.value()).unwrap_or_else(|| "text/plain".into());
    if ct.to_ascii_lowercase().starts_with("multipart/") {
        let Some(bd) = param(&ct, "boundary") else { return };
        let body = String::from_utf8_lossy(&msg.body).to_string();
        for part in body.split(&format!("--{bd}")).skip(1) {
            if part.starts_with("--") {
                break;
            }
            if let Ok(sub) = parse(part.trim_start_matches("\r\n").as_bytes()) {
                collect(&sub, plain, html);
            }
        }
    } else if ct.to_ascii_lowercase().starts_with("text/html") {
        html.push(strip_html(&String::from_utf8_lossy(&decode(msg))));
    } else if ct.to_ascii_lowercase().starts_with("text/plain") {
        plain.push(String::from_utf8_lossy(&decode(msg)).split_whitespace().collect::<Vec<_>>().join(" "));
    }
}

pub fn body_text(msg: &Message) -> String {
    let (mut plain, mut html) = (Vec::new(), Vec::new());
    collect(msg, &mut plain, &mut html);
    let text = if plain.iter().any(|p| !p.is_empty()) { plain.join("\n") } else { html.join("\n") };
    text.chars().take(MAX_CHARS).collect()
}
