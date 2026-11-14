use dibs_verifier::card::{card_message, card_op, check_trip, CardEnv, CardInput};
use dibs_verifier::http::Http;
use dibs_verifier::ops::Signer;
use dibs_verifier::seal;
use ed25519_dalek::{Signer as _, SigningKey, Verifier};
use serde_json::{json, Value};
use std::cell::RefCell;

const BOOKER_SEED: [u8; 32] = [7u8; 32];
const CARD_UUID: &str = "a2a6aa00-0c34-491b-9f8a-d762c5e28c3e";
const GOLDEN: &str = include_str!("fixtures/card-golden.json");

fn booker() -> String {
    hex::encode(SigningKey::from_bytes(&BOOKER_SEED).verifying_key().to_bytes())
}

struct Key(SigningKey);
impl Signer for Key {
    fn public_key(&self) -> Result<Vec<u8>, String> {
        Ok(self.0.verifying_key().to_bytes().to_vec())
    }
    fn sign(&self, m: &[u8]) -> Result<Vec<u8>, String> {
        Ok(self.0.sign(m).to_bytes().to_vec())
    }
}

/// Fake RPC + Lithic. Records every call (method, url, body) so tests can assert what was sent.
struct Fake {
    trip: Value,
    calls: RefCell<Vec<(String, String)>>,
    fail_lithic: bool,
    /// Simulates a retry: Lithic answers the rule create with 409 and the rule is already ACTIVE.
    rule_exists: bool,
}
impl Http for Fake {
    fn get(&self, url: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        self.calls.borrow_mut().push((url.to_string(), String::new()));
        if url.contains("/v1/cards/") {
            let pot = self.trip["n_beds"].as_u64().unwrap() * 25_000;
            assert!(url.ends_with(CARD_UUID));
            return Ok(json!({"token": CARD_UUID, "memo": "dibs lis0312", "spend_limit": pot, "last_four": "0165", "pan": "4111111111110165", "cvv": "123", "exp_month": "11", "exp_year": "2031"}).to_string().into_bytes());
        }
        let state = if self.rule_exists { "ACTIVE" } else { "INACTIVE" };
        Ok(json!({"token": "rule-1", "state": state}).to_string().into_bytes())
    }
    fn post(&self, url: &str, h: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        self.calls.borrow_mut().push((url.to_string(), String::from_utf8_lossy(body).to_string()));
        if url.contains("fastnear") {
            let bytes: Vec<u8> = self.trip.to_string().into_bytes();
            return Ok(json!({"result": {"result": bytes}}).to_string().into_bytes());
        }
        if self.fail_lithic {
            return Err("HTTP 500".into());
        }
        assert!(h.iter().any(|(k, v)| *k == "Authorization" && *v == "sk-test"));
        assert!(h.iter().any(|(k, v)| *k == "Idempotency-Key" && v.starts_with("dibs-")));
        if url.ends_with("/v1/cards") && self.rule_exists {
            return Err(format!("HTTP 409: {{\"message\": \"Conflict\", \"error_data\": {{\"conflicts_with\": \"{CARD_UUID}\", \"message\": \"Resource has been modified since creation\"}}}}"));
        }
        let out = if url.ends_with("/v1/cards") {
            json!({"token": "tok-1", "last_four": "0165", "pan": "4111111111110165", "cvv": "123", "exp_month": "11", "exp_year": "2031"})
        } else if url.ends_with("/v2/auth_rules") {
            if self.rule_exists {
                return Err("HTTP 409: {\"conflicts_with\":\"e1e3492b-a493-444f-b8ac-0ab0478e0911\"}".into());
            }
            json!({"token": "rule-1", "state": "INACTIVE"})
        } else if url.ends_with("/promote") {
            json!({"token": "rule-1", "state": "ACTIVE"})
        } else {
            return Err(format!("unexpected {url}"));
        };
        Ok(out.to_string().into_bytes())
    }
}

fn trip(statuses: &[&str], payout: Value) -> Value {
    let beds: Vec<Value> = statuses.iter().map(|s| json!({"holder": "x.testnet", "buyer": null, "status": s, "paid_from_chain": "near"})).collect();
    json!({"code": "lis0312", "price": "250000000", "n_beds": statuses.len(), "booker": booker(), "beds": beds,
        "payout": payout, "proof": null, "refunded": false})
}

fn run(fake: &Fake, network: &str, contract: Option<&str>) -> Result<Value, (String, String)> {
    let input = CardInput { trip: "lis0312".into(), network: network.into(), contract: contract.map(str::to_string) };
    let env = CardEnv { http: fake, lithic_key: "sk-test", lithic_root: "https://lithic.test", rpc: "https://test.rpc.fastnear.com" };
    card_op(&input, &env, &Key(SigningKey::from_bytes(&[9u8; 32]))).map_err(|e| (e.code.to_string(), e.message))
}
fn fake(t: Value) -> Fake {
    Fake { trip: t, calls: RefCell::new(vec![]), fail_lithic: false, rule_exists: false }
}
fn paid4() -> Value {
    trip(&["Paid"; 4], json!("None"))
}

#[test]
fn issues_signs_and_seals_to_the_booker() {
    let f = fake(paid4());
    let out = run(&f, "testnet", None).unwrap();
    assert_eq!(out["spend_limit"], 100_000); // 4 beds x 250 USDC = $1000.00 = 100000 cents
    assert_eq!((out["mcc"].as_str(), out["last4"].as_str()), (Some("7011"), Some("0165")));
    let msg = out["message"].as_str().unwrap();
    assert!(msg.starts_with("dibs-card:v1:{\"trip\":\"lis0312\",\"card_token\":\"tok-1\",\"last4\":\"0165\",\"spend_limit\":100000,\"mcc\":\"7011\",\"sealed_hex\":\""));
    assert_eq!(msg, card_message("lis0312", "tok-1", "0165", 100_000, "7011", out["sealed_hex"].as_str().unwrap()));
    let sk = SigningKey::from_bytes(&[9u8; 32]);
    let sig = ed25519_dalek::Signature::from_slice(&hex::decode(out["signature"].as_str().unwrap()).unwrap()).unwrap();
    assert!(sk.verifying_key().verify(msg.as_bytes(), &sig).is_ok());
    // only the booker's key opens it; nothing secret is in the clear output
    let plain = seal::open(&hex::decode(out["sealed_hex"].as_str().unwrap()).unwrap(), &BOOKER_SEED).unwrap();
    let p: Value = serde_json::from_slice(&plain).unwrap();
    assert_eq!((p["pan"].as_str(), p["cvv"].as_str(), p["exp"].as_str()), (Some("4111111111110165"), Some("123"), Some("11/2031")));
    assert!(seal::open(&hex::decode(out["sealed_hex"].as_str().unwrap()).unwrap(), &[8u8; 32]).is_err());
    let all = out.to_string();
    assert!(!all.contains("4111111111110165") && !all.contains("\"123\""));
}

#[test]
fn lithic_gets_a_single_use_card_and_a_lodging_only_rule() {
    let f = fake(paid4());
    run(&f, "testnet", None).unwrap();
    let calls = f.calls.borrow();
    let card: Value = serde_json::from_str(&calls.iter().find(|c| c.0.ends_with("/v1/cards")).unwrap().1).unwrap();
    assert_eq!((card["type"].as_str(), card["spend_limit"].as_u64(), card["memo"].as_str()), (Some("SINGLE_USE"), Some(100_000), Some("dibs lis0312")));
    let rule: Value = serde_json::from_str(&calls.iter().find(|c| c.0.ends_with("/v2/auth_rules")).unwrap().1).unwrap();
    assert_eq!(rule["card_tokens"], json!(["tok-1"]));
    assert_eq!(rule["parameters"]["action"], "DECLINE");
    assert_eq!(rule["parameters"]["conditions"][0]["operation"], "IS_NOT_ONE_OF");
    assert_eq!(rule["parameters"]["conditions"][0]["value"], json!(["7011"]));
    assert!(calls.iter().any(|c| c.0.ends_with("/v2/auth_rules/rule-1/promote")));
}

#[test]
fn refuses_unless_every_bed_is_paid_and_no_payout_started() {
    let cases: Vec<(Value, &str)> = vec![
        (trip(&["Paid", "Held", "Paid"], json!("None")), "E_NOT_FULL"),
        (trip(&["Paid", "Open"], json!("None")), "E_NOT_FULL"),
        (trip(&["Paid", "Listed"], json!("None")), "E_NOT_FULL"),
        (trip(&["Paid", "Paid"], json!({"Added": 3})), "E_PAYOUT_STARTED"),
        (trip(&["Paid", "Paid"], json!("Done")), "E_PAYOUT_STARTED"),
        (trip(&[], json!("None")), "E_TRIP_STATE"),
        (Value::Null, "E_NO_TRIP"),
    ];
    for (t, code) in cases {
        let f = fake(t.clone());
        let e = run(&f, "testnet", None).unwrap_err();
        assert_eq!(e.0, code, "{t}");
        assert!(f.calls.borrow().iter().all(|c| c.0.contains("fastnear")), "Lithic must not be called on {code}");
    }
    let mut t = paid4();
    t["refunded"] = json!(true);
    assert_eq!(check_trip(&t).err().unwrap().code, "E_REFUNDED");
    let mut t = paid4();
    t["proof"] = json!({"trip": "lis0312"});
    assert_eq!(check_trip(&t).err().unwrap().code, "E_PAYOUT_STARTED");
}

#[test]
fn refuses_bad_network_contract_booker_and_issuer_failure() {
    assert_eq!(run(&fake(paid4()), "mainnet", None).unwrap_err().0, "E_NETWORK");
    assert_eq!(run(&fake(paid4()), "testnet", Some("evil.testnet")).unwrap_err().0, "E_CONTRACT");
    let mut t = paid4();
    t["booker"] = json!("alice.testnet");
    let f = fake(t);
    assert_eq!(run(&f, "testnet", None).unwrap_err().0, "E_BOOKER");
    assert!(f.calls.borrow().iter().all(|c| c.0.contains("fastnear")), "no card is minted for an unsealable booker");
    let mut f = fake(paid4());
    f.fail_lithic = true;
    assert_eq!(run(&f, "testnet", None).unwrap_err().0, "E_ISSUER");
    let bad = CardInput { trip: "Bad Code".into(), network: "testnet".into(), contract: None };
    let env = CardEnv { http: &fake(paid4()), lithic_key: "k", lithic_root: "r", rpc: "x" };
    assert_eq!(card_op(&bad, &env, &Key(SigningKey::from_bytes(&[9u8; 32]))).unwrap_err().code, "E_INPUT");
}

#[test]
fn retry_is_idempotent_same_card_same_sealed_bytes() {
    let a = run(&fake(paid4()), "testnet", None).unwrap();
    let b = run(&fake(paid4()), "testnet", None).unwrap();
    assert_eq!(a["sealed_hex"], b["sealed_hex"]);
    assert_eq!(a["signature"], b["signature"]);
}

#[test]
fn retry_adopts_the_existing_card_and_active_rule_instead_of_failing() {
    let mut f = fake(paid4());
    f.rule_exists = true;
    let out = run(&f, "testnet", None).unwrap();
    assert_eq!(out["card_token"], CARD_UUID);
    let calls = f.calls.borrow();
    assert!(calls.iter().any(|c| c.0.ends_with("/v2/auth_rules/e1e3492b-a493-444f-b8ac-0ab0478e0911")), "reads the conflicting rule");
    assert!(!calls.iter().any(|c| c.0.ends_with("/promote")), "an ACTIVE rule is not promoted again");
}

#[test]
fn pot_in_cents_is_price_times_beds() {
    let mut t = trip(&["Paid"; 3], json!("None"));
    t["price"] = json!("1234560"); // 1.23456 USDC x 3 = 3.70368 -> 370 cents (rounds down)
    assert_eq!(check_trip(&t).unwrap().cents, 370);
}

#[test]
fn golden_vector_made_by_libsodium_opens_in_rust() {
    let g: Value = serde_json::from_str(GOLDEN).unwrap();
    let seed: [u8; 32] = hex::decode(g["ed25519_seed_hex"].as_str().unwrap()).unwrap().try_into().unwrap();
    let plain = seal::open(&hex::decode(g["libsodium_sealed_hex"].as_str().unwrap()).unwrap(), &seed).unwrap();
    assert_eq!(plain, g["plaintext"].as_str().unwrap().as_bytes());
    // and Rust's own seal is bit-identical to the recorded one, so libsodium and TS can open it
    let pk = hex::encode(SigningKey::from_bytes(&seed).verifying_key().to_bytes());
    let x = seal::implicit_to_x25519(&pk).unwrap();
    let eph: [u8; 32] = hex::decode(g["eph_seed_hex"].as_str().unwrap()).unwrap().try_into().unwrap();
    let mine = seal::seal(g["plaintext"].as_str().unwrap().as_bytes(), &x, eph).unwrap();
    assert_eq!(hex::encode(mine), g["rust_sealed_hex"].as_str().unwrap());
}
