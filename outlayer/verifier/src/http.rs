//! HTTP seam (wasi-http in production, fakes in tests) and the DNS-over-HTTPS resolver.
use crate::dkim::DnsTxt;
use serde::Deserialize;

pub trait Http {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String>;
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String>;
}

pub const DOH_URL: &str = "https://cloudflare-dns.com/dns-query";

#[derive(Deserialize)]
struct DohAnswer {
    #[serde(rename = "type")]
    kind: u32,
    data: String,
}

#[derive(Deserialize)]
struct DohReply {
    #[serde(rename = "Status")]
    status: u32,
    #[serde(rename = "Answer", default)]
    answer: Vec<DohAnswer>,
}

/// A TXT `data` field is one or more quoted strings; join them (RFC 6376 3.6.2.2).
fn unquote(data: &str) -> String {
    let mut out = String::new();
    let mut in_q = false;
    let mut esc = false;
    for c in data.chars() {
        match (in_q, esc, c) {
            (true, true, _) => {
                out.push(c);
                esc = false;
            }
            (true, false, '\\') => esc = true,
            (true, false, '"') => in_q = false,
            (true, false, _) => out.push(c),
            (false, _, '"') => in_q = true,
            _ => {}
        }
    }
    if out.is_empty() && !data.contains('"') {
        return data.to_string();
    }
    out
}

pub struct DohResolver<'a> {
    pub http: &'a dyn Http,
    pub url: &'a str,
}

impl DnsTxt for DohResolver<'_> {
    fn txt(&self, name: &str) -> Result<Vec<String>, String> {
        if !name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_') {
            return Err("bad DNS name".into());
        }
        let url = format!("{}?name={}&type=TXT", self.url, name);
        let body = self.http.get(&url, &[("Accept", "application/dns-json")])?;
        let reply: DohReply = serde_json::from_slice(&body).map_err(|e| format!("DoH json: {e}"))?;
        if reply.status != 0 {
            return Err(format!("DoH status {} for {name}", reply.status));
        }
        Ok(reply.answer.iter().filter(|a| a.kind == 16).map(|a| unquote(&a.data)).collect())
    }
}

/// Testnet fixture key for `dibs-test.example`, consulted before DNS (feature `test-domain`).
pub struct FixtureThenDns<'a> {
    pub fixture: Option<(&'a str, &'a str)>,
    pub inner: &'a dyn DnsTxt,
}

impl DnsTxt for FixtureThenDns<'_> {
    fn txt(&self, name: &str) -> Result<Vec<String>, String> {
        match self.fixture {
            Some((n, rec)) if n == name => Ok(vec![rec.to_string()]),
            _ => self.inner.txt(name),
        }
    }
}
