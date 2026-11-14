//! Native reproduction of the `booking` op with real HTTP. Usage (secrets via env, never printed):
//!   DIBS_BLOB_KEY=.. NEAR_AI_KEY=.. cargo run --release --example booking_live -- <input.json>
//! Prints per-stage timings and the verdict only; never the email text.
use dibs_verifier::dkim::DnsTxt;
use dibs_verifier::http::{DohResolver, Http, DOH_URL};
use dibs_verifier::nearai::{NearAi, BASE_URL};
use dibs_verifier::verify::{verify_booking, BookingInput, Ctx};
use dibs_verifier::{blob, config};
use std::time::Instant;

struct Live;
fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(120)).build()
}
impl Http for Live {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let t = Instant::now();
        let mut r = agent().get(url);
        for (k, v) in headers {
            r = r.set(k, v);
        }
        let mut buf = Vec::new();
        std::io::Read::read_to_end(&mut r.call().map_err(|e| e.to_string())?.into_reader(), &mut buf).map_err(|e| e.to_string())?;
        eprintln!("GET {} -> {} bytes in {:?}", url.split('?').next().unwrap(), buf.len(), t.elapsed());
        Ok(buf)
    }
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        let t = Instant::now();
        let mut r = agent().post(url);
        for (k, v) in headers {
            r = r.set(k, v);
        }
        let resp = match r.send_bytes(body) {
            Ok(r) => r,
            Err(ureq::Error::Status(c, r)) => return Err(format!("HTTP {c}: {}", r.into_string().unwrap_or_default())),
            Err(e) => return Err(e.to_string()),
        };
        let s = resp.into_string().map_err(|e| e.to_string())?;
        eprintln!("POST {} req {} B -> {} bytes in {:?}", url, body.len(), s.len(), t.elapsed());
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            eprintln!("  finish={} usage={} content_len={} reasoning_len={}", v["choices"][0]["finish_reason"], v["usage"], v["choices"][0]["message"]["content"].as_str().map_or(0, str::len), v["choices"][0]["message"]["reasoning_content"].as_str().map_or(0, str::len));
        }
        Ok(s.into_bytes())
    }
}

fn main() {
    let raw = std::fs::read_to_string(std::env::args().nth(1).expect("input.json")).unwrap();
    let i: BookingInput = serde_json::from_str(&raw).unwrap();
    let key = blob::parse_key(&std::env::var("DIBS_BLOB_KEY").unwrap()).unwrap();
    let http = Live;
    let doh = DohResolver { http: &http, url: DOH_URL };
    let dns: &dyn DnsTxt = &doh;
    let ai = NearAi { http: &http, api_key: std::env::var("NEAR_AI_KEY").unwrap_or_default(), base: BASE_URL.into() };
    let allowed = config::allowed_domains();
    let ctx = Ctx { http: &http, dns, extractor: &ai, blob_key: key, allowed_domains: &allowed };
    if std::env::var("OFFSETS").is_ok() {
        let enc = http.get(&i.blob_url, &[]).unwrap();
        let eml = blob::decrypt(&enc, &key).unwrap();
        let m = dibs_verifier::msg::parse(&eml).unwrap();
        let text = dibs_verifier::mime::body_text(&m);
        let lo = text.to_lowercase();
        eprintln!("text chars={} words={}", text.chars().count(), text.split_whitespace().count());
        for k in ["check-in", "total", "confirmation", "guests", "price"] {
            eprintln!("  {k}: first at char {:?}", lo.find(k).map(|b| lo[..b].chars().count()));
        }
    }
    let t = Instant::now();
    match verify_booking(&i, &ctx) {
        Ok((f, a, to)) => eprintln!("OK in {:?}: {:?} verified={:?} to_trip={to}", t.elapsed(), f, a.map(|a| a.verified)),
        Err(e) => eprintln!("ERR in {:?}: {} {}", t.elapsed(), e.code, e.message),
    }
}
