//! Exact signed-message formats. Field order is the contract with `contracts/dibs`.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const BOOKING_PREFIX: &str = "dibs-booking:v1:";
pub const VRF_PREFIX: &str = "dibs-vrf:v1:";

/// Facts signed for a booking. Serialization order IS the canonical order (no whitespace).
/// `total` is a decimal string of 6-decimal base units (micro-units) of `currency`, per contracts/INTERFACE.md.
/// No FX: the amount printed in the email is scaled by 10^6 and `currency` records what it was.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Facts {
    pub trip: String,
    pub stay: String,
    pub check_in: String,
    pub check_out: String,
    pub guests: u32,
    pub total: String,
    pub currency: String,
    pub dkim_domain: String,
    pub eml_sha256: String,
    pub booking_ref_hash: String,
}

impl Facts {
    pub fn signed_message(&self) -> String {
        format!("{}{}", BOOKING_PREFIX, serde_json::to_string(self).expect("facts serialize"))
    }
}

#[derive(Serialize)]
struct VrfBody<'a> {
    trip: &'a str,
    output_hex: &'a str,
}

pub fn vrf_message(trip: &str, output_hex: &str) -> String {
    let body = serde_json::to_string(&VrfBody { trip, output_hex }).expect("vrf serialize");
    format!("{VRF_PREFIX}{body}")
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

/// Strict decimal to minor units: `1234`, `1234.5`, `1234.50`. No separators, no sign.
pub fn parse_minor_units(s: &str) -> Result<u64, String> {
    let (int, frac) = match s.split_once('.') {
        Some((i, f)) => (i, f),
        None => (s, ""),
    };
    let ok = |x: &str| x.bytes().all(|b| b.is_ascii_digit());
    if int.is_empty() || int.len() > 12 || !ok(int) || frac.len() > 2 || !ok(frac) {
        return Err(format!("bad amount {s:?}"));
    }
    let cents = format!("{:0<2}", frac).parse::<u64>().map_err(|e| e.to_string())?;
    int.parse::<u64>().map(|i| i * 100 + cents).map_err(|e| e.to_string())
}

/// `YYYY-MM-DD` with a plausible calendar date.
pub fn valid_date(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' || !s.is_ascii() {
        return false;
    }
    let num = |r: std::ops::Range<usize>| s[r].parse::<u32>().ok();
    match (num(0..4), num(5..7), num(8..10)) {
        (Some(y), Some(m), Some(d)) => y >= 2000 && (1..=12).contains(&m) && (1..=31).contains(&d),
        _ => false,
    }
}

pub fn valid_trip(s: &str) -> bool {
    !s.is_empty() && s.len() <= 32 && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
