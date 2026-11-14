//! Fixture builder: self-signed test domain, local RSA key, DKIM signer, encrypted blob, mocks.
#![allow(dead_code)]
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};
use dibs_verifier::dkim::DnsTxt;
use dibs_verifier::http::Http;
use dibs_verifier::nearai::{Extraction, Extractor, RawFacts};
use dibs_verifier::ops::Signer;
use ed25519_dalek::{Signer as _, SigningKey};
use rsa::pkcs1v15::SigningKey as RsaSigner;
use rsa::pkcs8::{DecodePrivateKey, EncodePublicKey};
use rsa::signature::SignatureEncoding;
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub const KEY_PEM: &str = include_str!("../fixtures/dibs_test_dkim_key.pem");
pub const TEST_DOMAIN: &str = "dibs-test.example";
pub const AES_KEY: [u8; 32] = [7u8; 32];
pub const BODY: &str = "Your booking is confirmed!\r\nHotel Alfama Patio, Lisbon\r\nConfirmation number: 5123456789\r\n\
Check-in: 3 December 2026\r\nCheck-out: 7 December 2026\r\nGuests: 4 adults\r\nTotal price: EUR 1,480.00\r\n";

pub fn rsa_key() -> RsaPrivateKey {
    RsaPrivateKey::from_pkcs8_pem(KEY_PEM).expect("fixture key")
}

pub fn dns_record() -> String {
    let der = rsa_key().to_public_key().to_public_key_der().unwrap();
    format!("v=DKIM1; k=rsa; p={}", STANDARD.encode(der.as_bytes()))
}

pub struct Dns(pub HashMap<String, String>);
impl Dns {
    pub fn fixture(domain: &str) -> Dns {
        Dns(HashMap::from([(format!("t1._domainkey.{domain}"), dns_record())]))
    }
}
impl DnsTxt for Dns {
    fn txt(&self, name: &str) -> Result<Vec<String>, String> {
        Ok(self.0.get(name).cloned().into_iter().collect())
    }
}

fn relaxed(name: &str, value: &str) -> String {
    let v = value.replace("\r\n", "");
    format!("{}:{}\r\n", name.to_lowercase(), v.split_whitespace().collect::<Vec<_>>().join(" "))
}

/// A DKIM-signed (relaxed/relaxed, rsa-sha256) message from `from_domain`, signed as `d=`.
pub fn signed_eml(d: &str, from_domain: &str, subject: &str, body: &str) -> Vec<u8> {
    signed_eml_to(d, from_domain, "crew@example.org", subject, body)
}

/// Same, with a chosen To header (covered by the signature).
pub fn signed_eml_to(d: &str, from_domain: &str, to: &str, subject: &str, body: &str) -> Vec<u8> {
    let headers = format!(
        "From: Reservations <noreply@{from_domain}>\r\nTo: {to}\r\nSubject: {subject}\r\nDate: Mon, 14 Sep 2026 10:00:00 +0000\r\nMessage-ID: <abc123@{from_domain}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n"
    );
    let bh = STANDARD.encode(Sha256::digest(body.as_bytes()));
    let sig_hdr = format!("v=1; a=rsa-sha256; c=relaxed/relaxed; d={d}; s=t1; h=from:to:subject:date:message-id; bh={bh}; b=");
    let mut data = String::new();
    for h in ["From", "To", "Subject", "Date", "Message-ID"] {
        let line = headers.lines().find(|l| l.starts_with(&format!("{h}:"))).unwrap();
        data.push_str(&relaxed(h, line.split_once(':').unwrap().1));
    }
    data.push_str(relaxed("DKIM-Signature", &sig_hdr).trim_end());
    let sig = RsaSigner::<Sha256>::new(rsa_key()).sign(data.as_bytes());
    let b = STANDARD.encode(sig.to_bytes());
    format!("DKIM-Signature: {sig_hdr}{b}\r\n{headers}\r\n{body}").into_bytes()
}

pub fn valid_eml() -> Vec<u8> {
    signed_eml(TEST_DOMAIN, TEST_DOMAIN, "Booking confirmation for Hotel Alfama Patio", BODY)
}

pub fn encrypt(plain: &[u8], key: &[u8; 32]) -> Vec<u8> {
    let iv = [9u8; 12];
    let ct = Aes256Gcm::new(key.into()).encrypt(Nonce::from_slice(&iv), plain).unwrap();
    [iv.as_slice(), &ct].concat()
}

pub struct FakeHttp(pub Vec<u8>);
impl Http for FakeHttp {
    fn get(&self, _: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        Ok(self.0.clone())
    }
    fn post(&self, _: &str, _: &[(&str, &str)], _: &[u8]) -> Result<Vec<u8>, String> {
        Err("no post".into())
    }
}

pub fn good_facts() -> RawFacts {
    RawFacts {
        stay: "Hotel Alfama Patio".into(),
        check_in: "2026-12-03".into(),
        check_out: "2026-12-07".into(),
        guests: 4,
        total: "1480.00".into(),
        currency: "EUR".into(),
        booking_ref: "5123456789".into(),
    }
}

pub struct MockExtractor(pub RawFacts);
impl Extractor for MockExtractor {
    fn extract(&self, _: &str) -> Result<Extraction, String> {
        Ok(Extraction { facts: self.0.clone(), attestation: None })
    }
}

pub struct TestSigner(pub SigningKey);
impl TestSigner {
    pub fn new() -> Self {
        TestSigner(SigningKey::from_bytes(&[42u8; 32]))
    }
}
impl Signer for TestSigner {
    fn public_key(&self) -> Result<Vec<u8>, String> {
        Ok(self.0.verifying_key().to_bytes().to_vec())
    }
    fn sign(&self, m: &[u8]) -> Result<Vec<u8>, String> {
        Ok(self.0.sign(m).to_bytes().to_vec())
    }
}
