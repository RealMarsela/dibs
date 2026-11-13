//! Operation outputs: composes the signed messages and signs them (never caller-chosen bytes).
use crate::canon::{valid_trip, vrf_message, Facts};
use crate::nearai::Attestation;
use serde_json::{json, Value};

pub trait Signer {
    fn public_key(&self) -> Result<Vec<u8>, String>;
    fn sign(&self, message: &[u8]) -> Result<Vec<u8>, String>;
}

pub struct VrfOut {
    pub output_hex: String,
    pub signature_hex: String,
    pub alpha: String,
}

pub fn public_key_op(s: &dyn Signer) -> Result<Value, String> {
    Ok(json!({"public_key": hex::encode(s.public_key()?)}))
}

fn signed(s: &dyn Signer, message: String) -> Result<(String, String, String), String> {
    let sig = s.sign(message.as_bytes())?;
    Ok((message, hex::encode(sig), hex::encode(s.public_key()?)))
}

pub fn booking_op(facts: &Facts, att: Option<&Attestation>, s: &dyn Signer) -> Result<Value, String> {
    let (message, signature, public_key) = signed(s, facts.signed_message())?;
    Ok(json!({"facts": facts, "message": message, "signature": signature, "public_key": public_key, "near_ai": att}))
}

pub fn vrf_op(trip: &str, n: u32, gen: impl FnOnce(&str) -> Result<VrfOut, String>, s: &dyn Signer) -> Result<Value, String> {
    if !valid_trip(trip) {
        return Err("bad trip code".into());
    }
    if !(1..=64).contains(&n) {
        return Err("n must be 1..=64".into());
    }
    let v = gen(trip)?;
    if v.output_hex.len() != 64 || !v.output_hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("VRF output is not 32 bytes of hex".into());
    }
    let out = v.output_hex.to_ascii_lowercase();
    let (message, signature, public_key) = signed(s, vrf_message(trip, &out))?;
    Ok(json!({
        "trip": trip, "n": n, "output_hex": out,
        "message": message, "signature": signature, "public_key": public_key,
        "vrf_signature": v.signature_hex, "vrf_alpha": v.alpha,
    }))
}
