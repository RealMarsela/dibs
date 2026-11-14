//! Live proof against the REAL Lithic sandbox. From the repo root:
//!   set -a; . .secrets/lithic.env; set +a; cd outlayer/verifier && cargo run --release --example card_live
//! The trip state is a fake (the NEAR RPC is stubbed); Lithic is real. Prints last4 and request ids only,
//! never the PAN or CVV. The key comes from LITHIC_SANDBOX_KEY and is never printed.
use dibs_verifier::card::{card_op, CardEnv, CardInput};
use dibs_verifier::http::Http;
use dibs_verifier::ops::Signer;
use dibs_verifier::seal;
use ed25519_dalek::{Signer as _, SigningKey};
use serde_json::{json, Value};
use std::cell::RefCell;

struct Live {
    trip: Value,
    ids: RefCell<Vec<(String, String)>>,
}
impl Http for Live {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let mut r = agent().get(url);
        for (k, v) in headers {
            r = r.set(k, v);
        }
        r.call().map_err(|e| e.to_string())?.into_string().map(String::into_bytes).map_err(|e| e.to_string())
    }
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        if url.contains("fastnear") {
            return Ok(json!({"result": {"result": self.trip.to_string().into_bytes()}}).to_string().into_bytes());
        }
        let mut r = agent().post(url);
        for (k, v) in headers {
            r = r.set(k, v);
        }
        match r.send_bytes(body) {
            Ok(resp) => {
                let id = resp.header("x-correlation-id").unwrap_or("-").to_string();
                self.ids.borrow_mut().push((url.trim_start_matches("https://sandbox.lithic.com").to_string(), id));
                Ok(resp.into_string().map_err(|e| e.to_string())?.into_bytes())
            }
            Err(ureq::Error::Status(c, resp)) => Err(format!("HTTP {c}: {}", resp.into_string().unwrap_or_default())),
            Err(e) => Err(e.to_string()),
        }
    }
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(25)).build()
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

fn lithic(key: &str, method: &str, path: &str, body: Option<Value>) -> (Value, String) {
    let url = format!("https://sandbox.lithic.com{path}");
    let req = agent().request(method, &url).set("Authorization", key).set("Content-Type", "application/json");
    let res = match body {
        Some(b) => req.send_string(&b.to_string()),
        None => req.call(),
    };
    let resp = match res {
        Ok(r) => r,
        Err(ureq::Error::Status(_, r)) => r,
        Err(e) => panic!("{e}"),
    };
    let id = resp.header("x-correlation-id").unwrap_or("-").to_string();
    (serde_json::from_str(&resp.into_string().unwrap()).unwrap_or(Value::Null), id)
}

fn main() {
    let key = std::env::var("LITHIC_SANDBOX_KEY").expect("source .secrets/lithic.env first");
    let seed = [7u8; 32];
    let booker = hex::encode(SigningKey::from_bytes(&seed).verifying_key().to_bytes());
    let code = std::env::args().nth(1).unwrap_or_else(|| format!("live{}", std::process::id() % 10000));
    let beds: Vec<Value> = (0..4).map(|_| json!({"holder": "x.testnet", "buyer": null, "status": "Paid", "paid_from_chain": "near"})).collect();
    let trip = json!({"code": code, "price": "250000000", "n_beds": 4, "booker": booker, "beds": beds, "payout": "None", "proof": null, "refunded": false});
    let http = Live { trip, ids: RefCell::new(vec![]) };
    let input = CardInput { trip: code.clone(), network: "testnet".into(), contract: None };
    let env = CardEnv { http: &http, lithic_key: &key, lithic_root: "https://sandbox.lithic.com", rpc: "https://test.rpc.fastnear.com" };
    let out = card_op(&input, &env, &Key(SigningKey::from_bytes(&[9u8; 32]))).unwrap_or_else(|e| panic!("{} {}", e.code, e.message));
    println!("trip={code} card_token={} last4={} spend_limit_cents={} mcc={}", out["card_token"], out["last4"], out["spend_limit"], out["mcc"]);
    for (w, id) in http.ids.borrow().iter() {
        println!("  issue call {w} request_id={id}");
    }
    // The booker opens the sealed box with their key; the PAN is used for the simulation and never printed.
    let plain = seal::open(&hex::decode(out["sealed_hex"].as_str().unwrap()).unwrap(), &seed).expect("booker opens the box");
    let pan = serde_json::from_slice::<Value>(&plain).unwrap()["pan"].as_str().unwrap().to_string();
    let pot = out["spend_limit"].as_u64().unwrap();
    for (name, descriptor, mcc, amount) in [("electronics", "VOLTCITY ELECTRONICS", "5732", pot), ("carlton", "CARLTON CITY HOTEL SG", "7011", pot + std::env::var("EXTRA_CENTS").ok().and_then(|v| v.parse().ok()).unwrap_or(0))] {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let (s, sid) = lithic(&key, "POST", "/v1/simulate/authorize", Some(json!({"pan": pan, "amount": amount, "descriptor": descriptor, "mcc": mcc})));
        let token = s["token"].as_str().unwrap_or("").to_string();
        std::thread::sleep(std::time::Duration::from_secs(2));
        let (t, tid) = lithic(&key, "GET", &format!("/v1/transactions/{token}"), None);
        let reason = t["events"][0]["rule_results"][0]["result"].as_str().or(t["events"][0]["result"].as_str()).unwrap_or("?");
        println!("simulate {name} mcc={mcc} amount={amount}: result={} reason={reason} txn={token} simulate_request_id={sid} read_request_id={tid}", t["result"]);
    }
}
