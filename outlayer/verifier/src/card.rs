//! Op `card`: when every bed of a trip is paid, issue ONE single-use virtual card locked to lodging with a
//! limit equal to the pot, and seal its details to the booker's passkey key. The app reads the trip itself
//! from NEAR RPC (nobody can feed it a fake trip state); the issuer key is a sealed secret.
use crate::http::Http;
use crate::lithic::{Lithic, LODGING_MCC, SANDBOX_ROOT};
use crate::ops::Signer;
use crate::seal;
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};

pub const CARD_PREFIX: &str = "dibs-card:v1:";
/// Dibs contracts this app will read trips from (testnet only: the issuer is the Lithic sandbox).
pub const ALLOWED_TESTNET: &[&str] = &["dibs-0eb9ae.testnet"];
pub const RPC_TESTNET: &str = "https://test.rpc.fastnear.com";
/// Micro-USDC (6 decimals) per US cent.
const MICRO_PER_CENT: u128 = 10_000;

#[derive(Deserialize)]
pub struct CardInput {
    pub trip: String,
    pub network: String,
    #[serde(default)]
    pub contract: Option<String>,
}

#[derive(Debug)]
pub struct CardErr {
    pub code: &'static str,
    pub message: String,
}
fn err<T>(code: &'static str, m: impl Into<String>) -> Result<T, CardErr> {
    Err(CardErr { code, message: m.into() })
}

/// Trip code rule from the contract: 3-12 chars of [a-z0-9].
pub fn valid_code(s: &str) -> bool {
    (3..=12).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

pub fn view_trip(http: &dyn Http, rpc: &str, contract: &str, trip: &str) -> Result<Value, CardErr> {
    let args = base64::engine::general_purpose::STANDARD.encode(json!({"trip": trip}).to_string());
    let req = json!({"jsonrpc": "2.0", "id": "dibs", "method": "query", "params": {
        "request_type": "call_function", "finality": "final", "account_id": contract, "method_name": "get_trip", "args_base64": args}});
    let raw = http.post(rpc, &[("Content-Type", "application/json")], req.to_string().as_bytes()).map_err(|e| CardErr { code: "E_RPC", message: e })?;
    let v: Value = serde_json::from_slice(&raw).or_else(|e| err("E_RPC", format!("rpc json: {e}")))?;
    if let Some(e) = v.get("error") {
        return err("E_RPC", format!("rpc error: {}", e.get("cause").and_then(|c| c.get("name")).and_then(Value::as_str).unwrap_or("unknown")));
    }
    let bytes: Vec<u8> = v["result"]["result"].as_array().ok_or(()).or_else(|_| err("E_RPC", "rpc: no result"))?
        .iter().filter_map(|b| b.as_u64().map(|x| x as u8)).collect();
    let t: Value = serde_json::from_slice(&bytes).or_else(|_| err("E_NO_TRIP", "get_trip returned no trip"))?;
    if t.is_null() || t["code"].as_str() != Some(trip) {
        return err("E_NO_TRIP", "no such trip");
    }
    Ok(t)
}

/// The key to seal to: an implicit booker's own key, else the first FullAccess ed25519 key on a named account.
pub fn booker_x25519(http: &dyn Http, rpc: &str, booker: &str) -> Result<[u8; 32], CardErr> {
    if let Ok(x) = seal::implicit_to_x25519(booker) {
        return Ok(x);
    }
    let req = json!({"jsonrpc": "2.0", "id": "dibs", "method": "query", "params": {
        "request_type": "view_access_key_list", "finality": "final", "account_id": booker}});
    let raw = http.post(rpc, &[("Content-Type", "application/json")], req.to_string().as_bytes()).map_err(|e| CardErr { code: "E_RPC", message: e })?;
    let v: Value = serde_json::from_slice(&raw).or_else(|e| err("E_RPC", format!("rpc json: {e}")))?;
    let keys = v["result"]["keys"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    for k in keys {
        if k["access_key"]["permission"].as_str() != Some("FullAccess") {
            continue;
        }
        let Some(pk) = k["public_key"].as_str() else { continue };
        if let Ok(raw) = seal::near_key_bytes(pk) {
            if let Ok(x) = seal::ed_to_x25519(raw) {
                return Ok(x);
            }
        }
    }
    err("E_BOOKER", "booker has no usable FullAccess ed25519 key")
}

pub struct Plan {
    pub booker: String,
    pub cents: u64,
}

/// Every bed Paid, no payout started, no refund, price*n_beds fits a card.
pub fn check_trip(t: &Value) -> Result<Plan, CardErr> {
    let n = t["n_beds"].as_u64().unwrap_or(0) as usize;
    let beds = t["beds"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    if n == 0 || beds.len() != n {
        return err("E_TRIP_STATE", "trip has no beds");
    }
    if let Some(i) = beds.iter().position(|b| b["status"].as_str() != Some("Paid")) {
        return err("E_NOT_FULL", format!("bed {} is not Paid", i + 1));
    }
    if t["payout"].as_str() != Some("None") || !t["proof"].is_null() {
        return err("E_PAYOUT_STARTED", "the booker is already being paid; no card");
    }
    if t["refunded"].as_bool() == Some(true) {
        return err("E_REFUNDED", "trip is refunded");
    }
    let price: u128 = t["price"].as_str().and_then(|s| s.parse().ok()).ok_or(()).or_else(|_| err("E_TRIP_STATE", "bad price"))?;
    let cents = (price * n as u128) / MICRO_PER_CENT;
    if cents == 0 || cents > 500_000_00 {
        return err("E_POT", "pot is outside the card range ($0.01 to $500,000)");
    }
    let booker = t["booker"].as_str().unwrap_or("").to_string();
    Ok(Plan { booker, cents: cents as u64 })
}

/// Canonical signed message; key order and no whitespace are the contract.
pub fn card_message(trip: &str, token: &str, last4: &str, spend_limit: u64, mcc: &str, sealed_hex: &str) -> String {
    let s = |x: &str| serde_json::to_string(x).expect("string");
    format!("{CARD_PREFIX}{{\"trip\":{},\"card_token\":{},\"last4\":{},\"spend_limit\":{spend_limit},\"mcc\":{},\"sealed_hex\":{}}}",
        s(trip), s(token), s(last4), s(mcc), s(sealed_hex))
}

pub struct CardEnv<'a> {
    pub http: &'a dyn Http,
    pub lithic_key: &'a str,
    pub lithic_root: &'a str,
    pub rpc: &'a str,
}

pub fn card_op(i: &CardInput, env: &CardEnv, s: &dyn Signer) -> Result<Value, CardErr> {
    if !valid_code(&i.trip) {
        return err("E_INPUT", "bad trip code");
    }
    if i.network != "testnet" {
        return err("E_NETWORK", "only testnet (Lithic sandbox) is supported");
    }
    let contract = i.contract.as_deref().unwrap_or(ALLOWED_TESTNET[0]);
    if !ALLOWED_TESTNET.contains(&contract) {
        return err("E_CONTRACT", "contract is not on the allowlist");
    }
    if env.lithic_key.is_empty() {
        return err("E_SECRET", "LITHIC_API_KEY is not set");
    }
    let plan = check_trip(&view_trip(env.http, env.rpc, contract, &i.trip)?)?;
    let booker_x = booker_x25519(env.http, env.rpc, &plan.booker)?;
    let li = Lithic { http: env.http, key: env.lithic_key, root: env.lithic_root };
    let card = li.create_card(&i.trip, plan.cents).or_else(|m| err("E_ISSUER", m))?;
    li.lodging_only(&card.token, &i.trip).or_else(|m| err("E_ISSUER", m))?;
    let plain = json!({"pan": card.pan, "cvv": card.cvv, "exp": format!("{}/{}", card.exp_month, card.exp_year)}).to_string();
    let eph = seal::eph_seed(&[env.lithic_key.as_bytes(), i.trip.as_bytes(), card.token.as_bytes()]);
    let sealed = hex::encode(seal::seal(plain.as_bytes(), &booker_x, eph).or_else(|m| err("E_SEAL", m))?);
    let message = card_message(&i.trip, &card.token, &card.last4, plan.cents, LODGING_MCC, &sealed);
    let sig = s.sign(message.as_bytes()).or_else(|m| err("E_SIGN", m))?;
    let pk = s.public_key().or_else(|m| err("E_KEY", m))?;
    Ok(json!({"trip": i.trip, "card_token": card.token, "last4": card.last4, "spend_limit": plan.cents, "mcc": LODGING_MCC,
        "sealed_hex": sealed, "message": message, "signature": hex::encode(sig), "public_key": hex::encode(pk)}))
}

pub fn default_root() -> &'static str {
    SANDBOX_ROOT
}
