//! OutLayer WASI entry: stdin JSON in, one JSON object out. A failed check prints
//! `{"error":..,"code":..}` and exits 1, so the OutLayer callback receives no verdict.
use dibs_verifier::dkim::DnsTxt;
use dibs_verifier::http::{DohResolver, FixtureThenDns, Http, DOH_URL};
use dibs_verifier::nearai::{NearAi, BASE_URL};
use dibs_verifier::ops::{self, Signer, VrfOut};
use dibs_verifier::verify::{verify_booking, BookingInput, Ctx};
use dibs_verifier::{blob, config};
use outlayer::{signing_keys, vrf};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Read;

#[cfg(target_arch = "wasm32")]
#[used]
#[link_section = "outlayer.manifest"]
static OUTLAYER_MANIFEST: [u8; include_bytes!("../manifest.json").len()] = *include_bytes!("../manifest.json");

const KEY_PATH: &str = "dibs";

struct HostSigner;
impl Signer for HostSigner {
    fn public_key(&self) -> Result<Vec<u8>, String> {
        signing_keys::public_key(KEY_PATH, None).map_err(|e| e.to_string())
    }
    fn sign(&self, message: &[u8]) -> Result<Vec<u8>, String> {
        signing_keys::sign(KEY_PATH, None, message).map_err(|e| e.to_string())
    }
}

struct Wasi;
impl Http for Wasi {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let mut r = wasi_http_client::Client::new().get(url);
        for (k, v) in headers {
            r = r.header(*k, *v);
        }
        read(r.send().map_err(|e| format!("GET {url}: {e}"))?)
    }
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, String> {
        let mut r = wasi_http_client::Client::new().post(url).body(body);
        for (k, v) in headers {
            r = r.header(*k, *v);
        }
        read(r.send().map_err(|e| format!("POST {url}: {e}"))?)
    }
}

fn read(resp: wasi_http_client::Response) -> Result<Vec<u8>, String> {
    let status = resp.status();
    let body = resp.body().map_err(|e| format!("body: {e}"))?;
    if !(200..300).contains(&status) {
        return Err(format!("HTTP {status}"));
    }
    Ok(body)
}

#[derive(Deserialize)]
struct Op {
    op: String,
}
#[derive(Deserialize)]
struct VrfIn {
    trip: String,
    n: u32,
}

fn fail(code: &str, message: String) -> String {
    json!({"error": message, "code": code}).to_string()
}

fn run(raw: &str) -> Result<Value, String> {
    let op: Op = serde_json::from_str(raw).map_err(|e| fail("E_INPUT", format!("bad input: {e}")))?;
    match op.op.as_str() {
        "public_key" => ops::public_key_op(&HostSigner).map_err(|e| fail("E_KEY", e)),
        "vrf" => {
            let i: VrfIn = serde_json::from_str(raw).map_err(|e| fail("E_INPUT", e.to_string()))?;
            let gen = |seed: &str| vrf::random(seed).map(|v| VrfOut { output_hex: v.output_hex, signature_hex: v.signature_hex, alpha: v.alpha });
            ops::vrf_op(&i.trip, i.n, gen, &HostSigner).map_err(|e| fail("E_VRF", e))
        }
        "booking" => {
            let i: BookingInput = serde_json::from_str(raw).map_err(|e| fail("E_INPUT", e.to_string()))?;
            let secret = |k: &str| std::env::var(k).map_err(|_| fail("E_SECRET", format!("{k} is not set")));
            let blob_key = blob::parse_key(&secret("DIBS_BLOB_KEY")?).map_err(|e| fail("E_SECRET", e))?;
            let http = Wasi;
            let doh = DohResolver { http: &http, url: DOH_URL };
            let dns: &dyn DnsTxt = &FixtureThenDns { fixture: config::fixture_record(), inner: &doh };
            let ai = NearAi { http: &http, api_key: std::env::var("NEAR_AI_KEY").unwrap_or_default(), base: BASE_URL.into() };
            let allowed = config::allowed_domains();
            let ctx = Ctx { http: &http, dns, extractor: &ai, blob_key, allowed_domains: &allowed };
            let (facts, att, to_trip) = verify_booking(&i, &ctx).map_err(|e| fail(e.code, e.message))?;
            let mut out = ops::booking_op(&facts, att.as_ref(), &HostSigner).map_err(|e| fail("E_SIGN", e))?;
            out["to_trip"] = json!(to_trip);
            Ok(out)
        }
        "card" => {
            use dibs_verifier::card::{card_op, default_root, CardEnv, CardInput, RPC_TESTNET};
            let i: CardInput = serde_json::from_str(raw).map_err(|e| fail("E_INPUT", e.to_string()))?;
            let key = std::env::var("LITHIC_API_KEY").unwrap_or_default();
            let env = CardEnv { http: &Wasi, lithic_key: &key, lithic_root: default_root(), rpc: RPC_TESTNET };
            card_op(&i, &env, &HostSigner).map_err(|e| fail(e.code, e.message))
        }
        other => Err(fail("E_INPUT", format!("unknown op {other:?}"))),
    }
}

fn main() {
    let mut raw = String::new();
    let _ = std::io::stdin().read_to_string(&mut raw);
    match run(&raw) {
        Ok(out) => print!("{out}"),
        Err(e) => {
            print!("{e}");
            std::process::exit(1);
        }
    }
}
