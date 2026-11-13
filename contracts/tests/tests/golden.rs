//! Golden vectors for Lane B: byte-exact signed messages with a fixed test key (seed = 32 x 0x07).
//! The same builders feed the sandbox suite, so the contract is proven to accept exactly these bytes.
use dibs_tests::*;
use serde_json::json;

#[test]
fn golden_vectors_are_stable() {
    let k = key(7);
    let f = Facts::ok("lis0312", 8, 1_800_000);
    let booking = f.message();
    let out = "11".repeat(32);
    let vrf = vrf_message("lis0312", &out);
    let v = json!({
        "note": "TEST KEY ONLY (ed25519 seed = 32 bytes of 0x07). The real verifier key is pinned with set_verifier_key.",
        "public_key_hex": hex::encode(k.verifying_key().to_bytes()),
        "booking": {"message": booking, "signature_hex": sign(&k, &booking)},
        "vrf": {"message": vrf, "signature_hex": sign(&k, &vrf)},
    });
    assert!(booking.starts_with("dibs-booking:v1:{\"trip\":\"lis0312\",\"stay\":"));
    assert!(!booking.contains("\":\"  ") && !booking.contains("\", \"") && !booking.contains("\": "), "no whitespace between JSON tokens");
    let order = ["trip", "stay", "check_in", "check_out", "guests", "total", "currency", "dkim_domain", "eml_sha256", "booking_ref_hash"];
    let pos: Vec<usize> = order.iter().map(|k| booking.find(&format!("\"{k}\":")).unwrap()).collect();
    assert!(pos.windows(2).all(|w| w[0] < w[1]), "field order");
    std::fs::write(contracts_dir().join("fixtures/golden-vectors.json"), serde_json::to_string_pretty(&v).unwrap() + "\n").unwrap();
}
