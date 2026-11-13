//! DKIM (RFC 6376) verification: rsa-sha256 only, simple and relaxed canonicalization.
//! The signing key comes from a `DnsTxt` resolver (DNS-over-HTTPS in production, a fixture in tests).
use crate::msg::{Header, Message};
use base64::{engine::general_purpose::STANDARD, Engine};
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::pkcs8::DecodePublicKey;
use rsa::traits::PublicKeyParts;
use rsa::{Pkcs1v15Sign, RsaPublicKey};
use sha2::{Digest, Sha256};

pub trait DnsTxt {
    /// All TXT strings at `name`, each record's character-strings already joined.
    fn txt(&self, name: &str) -> Result<Vec<String>, String>;
}

#[derive(Debug, PartialEq)]
pub struct DkimPass {
    pub domain: String,
    pub selector: String,
}

fn is_wsp(b: u8) -> bool {
    b == b' ' || b == b'\t'
}

/// Relaxed header canonicalization of one raw field, with trailing CRLF.
fn relaxed_header(raw: &[u8]) -> Vec<u8> {
    let c = raw.iter().position(|&b| b == b':').unwrap_or(raw.len());
    let name = String::from_utf8_lossy(&raw[..c]).trim().to_ascii_lowercase();
    let mut value: Vec<u8> = Vec::new();
    let mut pending_space = false;
    for &b in raw.get(c + 1..).unwrap_or(&[]) {
        if b == b'\r' || b == b'\n' {
            continue;
        }
        if is_wsp(b) {
            pending_space = true;
        } else {
            if pending_space && !value.is_empty() {
                value.push(b' ');
            }
            pending_space = false;
            value.push(b);
        }
    }
    let mut out = name.into_bytes();
    out.push(b':');
    out.extend(value);
    out.extend_from_slice(b"\r\n");
    out
}

fn canon_header(raw: &[u8], relaxed: bool) -> Vec<u8> {
    if relaxed {
        relaxed_header(raw)
    } else {
        let mut v = raw.to_vec();
        v.extend_from_slice(b"\r\n");
        v
    }
}

fn canon_body(body: &[u8], relaxed: bool) -> Vec<u8> {
    let mut lines: Vec<Vec<u8>> = body
        .split(|&b| b == b'\n')
        .map(|l| l.strip_suffix(b"\r").unwrap_or(l).to_vec())
        .collect();
    if lines.last().is_some_and(|l| l.is_empty()) {
        lines.pop(); // text after the final CRLF
    }
    if relaxed {
        for l in lines.iter_mut() {
            let mut out: Vec<u8> = Vec::with_capacity(l.len());
            let mut sp = false;
            for &b in l.iter() {
                if is_wsp(b) {
                    sp = true;
                } else {
                    if sp {
                        out.push(b' ');
                    }
                    sp = false;
                    out.push(b);
                }
            }
            *l = out;
        }
    }
    while lines.last().is_some_and(|l| l.is_empty()) {
        lines.pop();
    }
    if lines.is_empty() {
        return if relaxed { Vec::new() } else { b"\r\n".to_vec() };
    }
    let mut out = Vec::new();
    for l in lines {
        out.extend(l);
        out.extend_from_slice(b"\r\n");
    }
    out
}

/// Tag list `a=b; c=d` as (name, raw value) pairs.
fn tags(s: &str) -> Vec<(String, String)> {
    s.split(';')
        .filter_map(|t| t.split_once('=').map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_string())))
        .collect()
}

fn tag<'a>(t: &'a [(String, String)], k: &str) -> Option<&'a str> {
    t.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_str())
}

/// Signature header raw text with the `b=` value emptied.
fn strip_b(raw: &[u8]) -> Vec<u8> {
    let s = String::from_utf8_lossy(raw).to_string();
    let c = s.find(':').unwrap_or(0);
    let (name, rest) = s.split_at(c + 1);
    let mut out = String::from(name);
    for (i, part) in rest.split(';').enumerate() {
        if i > 0 {
            out.push(';');
        }
        match part.split_once('=') {
            Some((k, _)) if k.trim().eq_ignore_ascii_case("b") => {
                out.push_str(k);
                out.push('=');
            }
            _ => out.push_str(part),
        }
    }
    out.into_bytes()
}

fn from_domain(msg: &Message) -> Result<String, String> {
    let from = msg.header("from").ok_or("no From header")?.value();
    let addr = match (from.rfind('<'), from.rfind('>')) {
        (Some(a), Some(b)) if a < b => &from[a + 1..b],
        _ => from.as_str(),
    };
    let dom = addr.rsplit_once('@').ok_or("From has no domain")?.1;
    Ok(dom.trim().trim_end_matches('>').to_ascii_lowercase())
}

fn parse_key(p: &str) -> Result<RsaPublicKey, String> {
    let der = STANDARD.decode(p.split_whitespace().collect::<String>()).map_err(|e| format!("key base64: {e}"))?;
    let key = RsaPublicKey::from_public_key_der(&der)
        .or_else(|_| RsaPublicKey::from_pkcs1_der(&der))
        .map_err(|e| format!("key parse: {e}"))?;
    if key.size() * 8 < 1024 {
        return Err("RSA key under 1024 bits".into());
    }
    Ok(key)
}

fn verify_one(msg: &Message, sig: &Header, dns: &dyn DnsTxt) -> Result<DkimPass, String> {
    let t = tags(&sig.value());
    let need = |k: &str| tag(&t, k).filter(|v| !v.is_empty()).ok_or(format!("missing tag {k}="));
    if need("v")? != "1" || !need("a")?.eq_ignore_ascii_case("rsa-sha256") {
        return Err("only v=1 rsa-sha256 is supported".into());
    }
    let (d, s) = (need("d")?.to_ascii_lowercase(), need("s")?.to_string());
    let signed: Vec<String> = need("h")?.split(':').map(|h| h.trim().to_ascii_lowercase()).collect();
    if !signed.iter().any(|h| h == "from") {
        return Err("h= does not cover From".into());
    }
    let canon = tag(&t, "c").unwrap_or("simple/simple").to_ascii_lowercase();
    let (hc, bc) = canon.split_once('/').unwrap_or((canon.as_str(), "simple"));
    let (hrel, brel) = (hc == "relaxed", bc == "relaxed");

    let fd = from_domain(msg)?;
    if fd != d && !fd.ends_with(&format!(".{d}")) {
        return Err(format!("From domain {fd} not aligned with d={d}"));
    }

    let mut body = canon_body(&msg.body, brel);
    if let Some(l) = tag(&t, "l") {
        let l: usize = l.parse().map_err(|_| "bad l=")?;
        body.truncate(l);
    }
    let bh = STANDARD.decode(need("bh")?.split_whitespace().collect::<String>()).map_err(|_| "bad bh=")?;
    if Sha256::digest(&body).as_slice() != bh.as_slice() {
        return Err("body hash mismatch".into());
    }

    let mut data: Vec<u8> = Vec::new();
    for (i, name) in signed.iter().enumerate() {
        let skip = signed[..i].iter().filter(|n| *n == name).count();
        let found = msg.headers.iter().rev().filter(|h| h.name.eq_ignore_ascii_case(name)).nth(skip);
        if let Some(h) = found {
            data.extend(canon_header(&h.raw, hrel));
        }
    }
    let mut own = canon_header(&strip_b(&sig.raw), hrel);
    own.truncate(own.len() - 2); // the signature header carries no trailing CRLF
    data.extend(own);

    let rec = format!("{s}._domainkey.{d}");
    let sig_bytes = STANDARD.decode(need("b")?.split_whitespace().collect::<String>()).map_err(|_| "bad b=")?;
    let digest = Sha256::digest(&data);
    let mut last = format!("no usable key at {rec}");
    for txt in dns.txt(&rec)? {
        let kt = tags(&txt);
        if tag(&kt, "k").is_some_and(|k| !k.eq_ignore_ascii_case("rsa")) {
            continue;
        }
        let Some(p) = tag(&kt, "p").filter(|p| !p.is_empty()) else { continue };
        match parse_key(p) {
            Ok(key) => match key.verify(Pkcs1v15Sign::new::<Sha256>(), &digest, &sig_bytes) {
                Ok(()) => return Ok(DkimPass { domain: d, selector: s }),
                Err(_) => last = "signature mismatch".into(),
            },
            Err(e) => last = e,
        }
    }
    Err(last)
}

/// Passes when some DKIM-Signature verifies, is aligned with From, and its key resolves.
pub fn verify(msg: &Message, dns: &dyn DnsTxt) -> Result<DkimPass, String> {
    let sigs: Vec<&Header> = msg.headers.iter().filter(|h| h.name.eq_ignore_ascii_case("dkim-signature")).collect();
    if sigs.is_empty() {
        return Err("no DKIM-Signature".into());
    }
    let mut errs = Vec::new();
    for s in sigs {
        match verify_one(msg, s, dns) {
            Ok(p) => return Ok(p),
            Err(e) => errs.push(e),
        }
    }
    Err(errs.join("; "))
}
