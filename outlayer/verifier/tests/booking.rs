mod common;
use common::*;
use dibs_verifier::canon::sha256_hex;
use dibs_verifier::nearai::RawFacts;
use dibs_verifier::ops;
use dibs_verifier::verify::{verify_booking, BookingInput, Ctx, Expect, VerifyError};

const ALLOWED_TEST: &[&str] = &["booking.com", "airbnb.com", "hostelworld.com", TEST_DOMAIN];
const ALLOWED_PROD: &[&str] = &["booking.com", "airbnb.com", "hostelworld.com"];

fn input(blob: &[u8]) -> BookingInput {
    BookingInput {
        trip: "lis0312".into(),
        blob_url: "https://blobs.example/lis0312".into(),
        blob_sha256: sha256_hex(blob),
        expect: Expect { check_in: "2026-12-03".into(), check_out: "2026-12-07".into(), guests: 4, max_total: 1_600_000_000, currency: None },
    }
}

fn run(eml: &[u8], facts: RawFacts, allowed: &[&str], tweak: impl FnOnce(&mut BookingInput)) -> Result<dibs_verifier::canon::Facts, VerifyError> {
    let blob = encrypt(eml, &AES_KEY);
    let mut inp = input(&blob);
    tweak(&mut inp);
    let http = FakeHttp(blob);
    let dns = Dns::fixture(TEST_DOMAIN);
    let ex = MockExtractor(facts);
    let ctx = Ctx { http: &http, dns: &dns, extractor: &ex, blob_key: AES_KEY, allowed_domains: allowed };
    verify_booking(&inp, &ctx).map(|r| r.0)
}

fn code(r: Result<dibs_verifier::canon::Facts, VerifyError>) -> &'static str {
    r.expect_err("expected a refusal").code
}

#[test]
fn valid_email_signs_the_exact_facts() {
    let eml = valid_eml();
    let facts = run(&eml, good_facts(), ALLOWED_TEST, |_| {}).expect("valid email");
    assert_eq!(facts.dkim_domain, TEST_DOMAIN);
    assert_eq!(facts.total, "1480000000");
    assert_eq!(facts.eml_sha256, sha256_hex(&eml));
    let msg = facts.signed_message();
    let want = format!(
        "dibs-booking:v1:{{\"trip\":\"lis0312\",\"stay\":\"Hotel Alfama Patio\",\"check_in\":\"2026-12-03\",\"check_out\":\"2026-12-07\",\"guests\":4,\"total\":\"1480000000\",\"currency\":\"EUR\",\"dkim_domain\":\"dibs-test.example\",\"eml_sha256\":\"{}\",\"booking_ref_hash\":\"{}\"}}",
        sha256_hex(&eml),
        sha256_hex(b"5123456789")
    );
    assert_eq!(msg, want);
    // the output carries no name, address, card or raw email
    let s = TestSigner::new();
    let out = ops::booking_op(&facts, None, &s).unwrap().to_string();
    assert!(!out.contains("5123456789") && !out.contains("noreply@") && !out.contains("Reservations"));
    // signature verifies under the public key over exactly `message`
    use ed25519_dalek::{Signature, Verifier};
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    let pk: [u8; 32] = hex::decode(v["public_key"].as_str().unwrap()).unwrap().try_into().unwrap();
    let sig: [u8; 64] = hex::decode(v["signature"].as_str().unwrap()).unwrap().try_into().unwrap();
    let vk = ed25519_dalek::VerifyingKey::from_bytes(&pk).unwrap();
    assert!(vk.verify(v["message"].as_str().unwrap().as_bytes(), &Signature::from_bytes(&sig)).is_ok());
    assert!(vk.verify(msg.replace("1480000000", "1480000001").as_bytes(), &Signature::from_bytes(&sig)).is_err());
}

#[test]
fn committed_fixture_eml_verifies() {
    let eml = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/valid.eml")).expect("fixtures/valid.eml");
    assert!(run(&eml, good_facts(), ALLOWED_TEST, |_| {}).is_ok());
}

#[test]
fn tampered_body_fails_dkim() {
    let eml = String::from_utf8(valid_eml()).unwrap().replace("EUR 1,480.00", "EUR 1,490.00");
    let mut f = good_facts();
    f.total = "1490.00".into();
    assert_eq!(code(run(eml.as_bytes(), f, ALLOWED_TEST, |_| {})), "E_DKIM");
}

#[test]
fn tampered_signed_header_fails_dkim() {
    let eml = String::from_utf8(valid_eml()).unwrap().replace("Subject: Booking", "Subject: Cancelled");
    assert_eq!(code(run(eml.as_bytes(), good_facts(), ALLOWED_TEST, |_| {})), "E_DKIM");
}

#[test]
fn header_whitespace_changes_in_transit_still_pass_relaxed() {
    let eml = String::from_utf8(valid_eml()).unwrap().replace("Subject: Booking confirmation", "Subject:   Booking \r\n  confirmation");
    assert!(run(eml.as_bytes(), good_facts(), ALLOWED_TEST, |_| {}).is_ok());
}

#[test]
fn wrong_domain_is_refused() {
    // valid signature, but the domain is not on the production allowlist
    assert_eq!(code(run(&valid_eml(), good_facts(), ALLOWED_PROD, |_| {})), "E_DOMAIN");
}

#[test]
fn spoofed_from_with_foreign_signature_fails_alignment() {
    // From says booking.com, signature is by dibs-test.example
    let eml = signed_eml(TEST_DOMAIN, "booking.com", "Booking confirmation", BODY);
    assert_eq!(code(run(&eml, good_facts(), ALLOWED_TEST, |_| {})), "E_DKIM");
}

#[test]
fn missing_dkim_signature_fails() {
    let eml = String::from_utf8(valid_eml()).unwrap();
    let stripped = eml.split_once("\r\nFrom:").map(|(_, r)| format!("From:{r}")).unwrap();
    assert_eq!(code(run(stripped.as_bytes(), good_facts(), ALLOWED_TEST, |_| {})), "E_DKIM");
}

#[test]
fn amount_over_the_cap_is_refused() {
    assert_eq!(code(run(&valid_eml(), good_facts(), ALLOWED_TEST, |i| i.expect.max_total = 1_479_999_999)), "E_OVER_CAP");
}

#[test]
fn wrong_dates_are_refused() {
    let mut f = good_facts();
    f.check_in = "2026-12-04".into();
    assert_eq!(code(run(&valid_eml(), f, ALLOWED_TEST, |_| {})), "E_DATES");
    assert_eq!(code(run(&valid_eml(), good_facts(), ALLOWED_TEST, |i| i.expect.check_out = "2026-12-08".into())), "E_DATES");
}

#[test]
fn wrong_guest_count_and_currency_are_refused() {
    assert_eq!(code(run(&valid_eml(), good_facts(), ALLOWED_TEST, |i| i.expect.guests = 5)), "E_GUESTS");
    assert_eq!(code(run(&valid_eml(), good_facts(), ALLOWED_TEST, |i| i.expect.currency = Some("USD".into()))), "E_CURRENCY");
}

#[test]
fn model_facts_must_be_grounded_in_the_verified_email() {
    let mut f = good_facts();
    f.booking_ref = "9999999999".into();
    assert_eq!(code(run(&valid_eml(), f, ALLOWED_TEST, |_| {})), "E_FACTS");
    let mut f = good_facts();
    f.total = "100.00".into(); // under the cap but not what the email says
    assert_eq!(code(run(&valid_eml(), f, ALLOWED_TEST, |_| {})), "E_FACTS");
    let mut f = good_facts();
    f.check_in = "3 Dec 2026".into();
    assert_eq!(code(run(&valid_eml(), f, ALLOWED_TEST, |_| {})), "E_FACTS");
}

#[test]
fn blob_hash_and_key_are_enforced() {
    let eml = valid_eml();
    assert_eq!(code(run(&eml, good_facts(), ALLOWED_TEST, |i| i.blob_sha256 = sha256_hex(b"other"))), "E_BLOB_HASH");
    let blob = encrypt(&eml, &[1u8; 32]); // encrypted under another key
    let (http, dns, ex) = (FakeHttp(blob.clone()), Dns::fixture(TEST_DOMAIN), MockExtractor(good_facts()));
    let ctx = Ctx { http: &http, dns: &dns, extractor: &ex, blob_key: AES_KEY, allowed_domains: ALLOWED_TEST };
    assert_eq!(code(verify_booking(&input(&blob), &ctx).map(|r| r.0)), "E_DECRYPT");
    let mut flipped = encrypt(&eml, &AES_KEY);
    let n = flipped.len();
    flipped[n - 1] ^= 1;
    let http = FakeHttp(flipped.clone());
    let ctx = Ctx { http: &http, dns: &dns, extractor: &ex, blob_key: AES_KEY, allowed_domains: ALLOWED_TEST };
    assert_eq!(code(verify_booking(&input(&flipped), &ctx).map(|r| r.0)), "E_DECRYPT");
}

#[test]
fn unknown_dns_key_and_bad_input_are_refused() {
    let eml = valid_eml();
    let blob = encrypt(&eml, &AES_KEY);
    let (http, dns, ex) = (FakeHttp(blob.clone()), Dns(Default::default()), MockExtractor(good_facts()));
    let ctx = Ctx { http: &http, dns: &dns, extractor: &ex, blob_key: AES_KEY, allowed_domains: ALLOWED_TEST };
    assert_eq!(code(verify_booking(&input(&blob), &ctx).map(|r| r.0)), "E_DKIM");
    assert_eq!(code(run(&eml, good_facts(), ALLOWED_TEST, |i| i.trip = "Lis:03".into())), "E_INPUT");
    assert_eq!(code(run(&eml, good_facts(), ALLOWED_TEST, |i| i.blob_url = "http://x".into())), "E_INPUT");
}
