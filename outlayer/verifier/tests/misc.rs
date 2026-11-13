mod common;
use common::*;
use dibs_verifier::canon::{parse_minor_units, sha256_hex, valid_date, vrf_message};
use dibs_verifier::dkim::DnsTxt;
use dibs_verifier::http::{DohResolver, Http};
use dibs_verifier::nearai::{Extractor, NearAi, MODEL};
use dibs_verifier::ops::{self, VrfOut};
use ed25519_dalek::{Signer, SigningKey};
use serde_json::json;
use std::cell::RefCell;

/// `cargo test --test misc regenerate_fixtures -- --ignored` rewrites tests/fixtures/*.eml (RSA PKCS1v15 is deterministic).
#[test]
#[ignore]
fn regenerate_fixtures() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/");
    std::fs::write(format!("{dir}valid.eml"), valid_eml()).unwrap();
    std::fs::write(format!("{dir}tampered_body.eml"), String::from_utf8(valid_eml()).unwrap().replace("EUR 1,480.00", "EUR 1,490.00")).unwrap();
    std::fs::write(format!("{dir}wrong_domain.eml"), signed_eml("evil.example", "evil.example", "Booking confirmation", BODY)).unwrap();
}

#[test]
fn booking_input_matches_the_contract_shape() {
    use dibs_verifier::verify::BookingInput;
    let mk = |mt: serde_json::Value| json!({"op":"booking","trip":"lis0312","blob_url":"https://x/y","blob_sha256":"00",
        "expect":{"check_in":"2026-12-03","check_out":"2026-12-07","guests":4,"max_total":mt}});
    let a: BookingInput = serde_json::from_value(mk(json!("2000000"))).unwrap();
    let b: BookingInput = serde_json::from_value(mk(json!(2000000))).unwrap();
    assert_eq!((a.expect.max_total, b.expect.max_total), (2_000_000, 2_000_000));
    assert!(a.expect.currency.is_none());
    assert!(serde_json::from_value::<BookingInput>(mk(json!("12abc"))).is_err());
}

#[test]
fn amounts_dates_and_vrf_message() {
    assert_eq!(parse_minor_units("1480").unwrap(), 148_000);
    assert_eq!(parse_minor_units("1480.5").unwrap(), 148_050);
    assert_eq!(parse_minor_units("0.07").unwrap(), 7);
    for bad in ["", "-1", "1,480.00", "1.234", "1e3", "12345678901234"] {
        assert!(parse_minor_units(bad).is_err(), "{bad}");
    }
    assert!(valid_date("2026-12-03") && !valid_date("2026-13-03") && !valid_date("3 Dec 2026"));
    let h = "ab".repeat(32);
    assert_eq!(vrf_message("lis0312", &h), format!("dibs-vrf:v1:{{\"trip\":\"lis0312\",\"output_hex\":\"{h}\"}}"));
}

#[test]
fn vrf_op_signs_the_exact_message_and_validates_input() {
    let s = TestSigner::new();
    let gen = |seed: &str| {
        assert_eq!(seed, "lis0312");
        Ok(VrfOut { output_hex: "ab".repeat(32), signature_hex: "cd".repeat(64), alpha: "vrf:1:crew.testnet:lis0312".into() })
    };
    let out = ops::vrf_op("lis0312", 4, gen, &s).unwrap();
    assert_eq!(out["message"], vrf_message("lis0312", &"ab".repeat(32)));
    assert_eq!(out["vrf_alpha"], "vrf:1:crew.testnet:lis0312");
    let bad = |_: &str| Ok(VrfOut { output_hex: "zz".into(), signature_hex: String::new(), alpha: String::new() });
    assert!(ops::vrf_op("lis0312", 4, bad, &s).is_err());
    assert!(ops::vrf_op("a:b", 4, |_| unreachable!(), &s).is_err());
    assert!(ops::vrf_op("lis0312", 0, |_| unreachable!(), &s).is_err());
}

struct Recorder {
    replies: Vec<Vec<u8>>,
    seen: RefCell<Vec<(String, Vec<(String, String)>, Vec<u8>)>>,
}
impl Http for Recorder {
    fn get(&self, url: &str, h: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let mut seen = self.seen.borrow_mut();
        seen.push((url.into(), h.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect(), vec![]));
        Ok(self.replies[seen.len() - 1].clone())
    }
    fn post(&self, url: &str, h: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        let mut seen = self.seen.borrow_mut();
        seen.push((url.into(), h.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect(), body.to_vec()));
        Ok(self.replies[seen.len() - 1].clone())
    }
}

fn completion(content: &str) -> Vec<u8> {
    json!({"id": "chatcmpl-1", "choices": [{"message": {"content": content}}]}).to_string().into_bytes()
}
const FACTS_JSON: &str = r#"{"stay":"Hotel Alfama Patio","check_in":"2026-12-03","check_out":"2026-12-07","guests":4,"total":"1480.00","currency":"EUR","booking_ref":"5123456789"}"#;

fn near_ai(sig_text: Option<String>, tamper: bool) -> (Vec<u8>, Recorder) {
    let completion = completion(FACTS_JSON);
    let sk = SigningKey::from_bytes(&[5u8; 32]);
    // the signed text needs the exact request bytes, which only the extractor knows: run once to learn them
    let probe = Recorder { replies: vec![completion.clone(), b"{}".to_vec()], seen: Default::default() };
    NearAi { http: &probe, api_key: "k".into(), base: "https://ai.test".into() }.extract("hello").unwrap();
    let req = probe.seen.borrow()[0].2.clone();
    let mut text = sig_text.unwrap_or(format!("{MODEL}:{}:{}", sha256_hex(&req), sha256_hex(&completion)));
    if tamper {
        text.push('x');
    }
    let sig = json!({"text": text, "signature": hex::encode(sk.sign(text.as_bytes()).to_bytes()),
        "signing_address": hex::encode(sk.verifying_key().to_bytes()), "signing_algo": "ed25519", "signature_kind": "provider_tee"});
    (req, Recorder { replies: vec![completion, sig.to_string().into_bytes()], seen: Default::default() })
}

#[test]
fn near_ai_request_is_pinned_and_signature_is_checked() {
    let (req, rec) = near_ai(None, false);
    let ex = NearAi { http: &rec, api_key: "sk-test".into(), base: "https://ai.test".into() }.extract("hello").unwrap();
    assert_eq!(ex.facts.total, "1480.00");
    let a = ex.attestation.expect("attestation");
    assert!(a.verified && a.signature_kind == "provider_tee" && a.chat_id == "chatcmpl-1");
    let seen = rec.seen.borrow();
    assert_eq!(seen[0].0, "https://ai.test/v1/chat/completions");
    assert_eq!(seen[0].2, req);
    let hdr = |n: &str| seen[0].1.iter().find(|(k, _)| k == n).map(|(_, v)| v.clone());
    assert_eq!(hdr("x-no-aliasing").as_deref(), Some("true"));
    assert_eq!(hdr("Authorization").as_deref(), Some("Bearer sk-test"));
    assert!(seen[1].0.ends_with("/v1/signature/chatcmpl-1?signing_algo=ed25519"));
    let body: serde_json::Value = serde_json::from_slice(&req).unwrap();
    assert_eq!(body["model"], MODEL);
}

#[test]
fn near_ai_signature_for_other_bytes_is_not_verified() {
    let (_, rec) = near_ai(None, true);
    let a = NearAi { http: &rec, api_key: "k".into(), base: "https://ai.test".into() }.extract("hello").unwrap().attestation.unwrap();
    assert!(!a.verified);
}

#[test]
fn near_ai_rejects_loose_model_output() {
    for bad in ["not json", r#"{"stay":"x"}"#, &FACTS_JSON.replace("}", ",\"extra\":1}")] {
        let rec = Recorder { replies: vec![completion(bad)], seen: Default::default() };
        let r = NearAi { http: &rec, api_key: "k".into(), base: "https://ai.test".into() }.extract("hello");
        assert!(r.is_err(), "{bad}");
    }
}

#[test]
fn doh_resolver_joins_txt_strings_and_filters_types() {
    let reply = json!({"Status": 0, "Answer": [
        {"name": "x", "type": 5, "data": "alias.example."},
        {"name": "x", "type": 16, "data": "\"v=DKIM1; k=rsa; p=AAAA\" \"BBBB\""}]});
    let rec = Recorder { replies: vec![reply.to_string().into_bytes()], seen: Default::default() };
    let r = DohResolver { http: &rec, url: "https://doh.test/dns-query" };
    assert_eq!(r.txt("t1._domainkey.booking.com").unwrap(), vec!["v=DKIM1; k=rsa; p=AAAABBBB".to_string()]);
    assert_eq!(rec.seen.borrow()[0].0, "https://doh.test/dns-query?name=t1._domainkey.booking.com&type=TXT");
    assert!(r.txt("bad name?x=1").is_err());
    let nx = Recorder { replies: vec![json!({"Status": 3}).to_string().into_bytes()], seen: Default::default() };
    assert!(DohResolver { http: &nx, url: "u" }.txt("a.b").is_err());
}
