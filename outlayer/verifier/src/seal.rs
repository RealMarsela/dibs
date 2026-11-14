//! libsodium-compatible `crypto_box_seal` to an ed25519 account key.
//! Layout: `epk(32) || XSalsa20-Poly1305(msg)`, nonce = blake2b-24(epk || recipient_x25519).
//! The ephemeral key is derived from caller-supplied secret material (no RNG in the wasm guest); it is
//! unique per card and never leaves the enclave.
use blake2::digest::VariableOutput;
use blake2::Blake2bVar;
use crypto_box::aead::Aead;
use crypto_box::{PublicKey, SalsaBox, SecretKey};
use ed25519_dalek::VerifyingKey;
use sha2::{Digest, Sha256};

/// A NEAR implicit account id (64 hex) is an ed25519 public key; return its X25519 (Montgomery) form.
pub fn implicit_to_x25519(account_id: &str) -> Result<[u8; 32], String> {
    if account_id.len() != 64 || !account_id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) {
        return Err("booker is not an implicit account (64 lowercase hex)".into());
    }
    let raw: [u8; 32] = hex::decode(account_id).map_err(|e| e.to_string())?.try_into().map_err(|_| "length".to_string())?;
    ed_to_x25519(raw)
}

/// Base58 (bitcoin alphabet) decode, enough for NEAR public keys.
pub fn base58_decode(s: &str) -> Result<Vec<u8>, String> {
    const A: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut out: Vec<u8> = Vec::new();
    for ch in s.bytes() {
        let mut carry = A.iter().position(|&a| a == ch).ok_or("bad base58 character")? as u32;
        for b in out.iter_mut() {
            carry += (*b as u32) * 58;
            *b = (carry & 0xff) as u8;
            carry >>= 8;
        }
        while carry > 0 {
            out.push((carry & 0xff) as u8);
            carry >>= 8;
        }
    }
    out.extend(std::iter::repeat(0).take(s.bytes().take_while(|&c| c == b'1').count()));
    out.reverse();
    Ok(out)
}

/// `ed25519:<base58>` NEAR public key to its 32 raw bytes.
pub fn near_key_bytes(k: &str) -> Result<[u8; 32], String> {
    let b58 = k.strip_prefix("ed25519:").ok_or("not an ed25519 key")?;
    base58_decode(b58)?.try_into().map_err(|_| "ed25519 key is not 32 bytes".to_string())
}

pub fn ed_to_x25519(raw: [u8; 32]) -> Result<[u8; 32], String> {
    let vk = VerifyingKey::from_bytes(&raw).map_err(|e| format!("booker key is not a valid ed25519 point: {e}"))?;
    if vk.is_weak() {
        return Err("booker key is a small-order point".into());
    }
    Ok(vk.to_montgomery().to_bytes())
}

/// Ephemeral X25519 seed: sha256 over domain, then each part length-prefixed.
pub fn eph_seed(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    Digest::update(&mut h, b"dibs-card-seal:v1");
    for p in parts {
        Digest::update(&mut h, (p.len() as u32).to_be_bytes());
        Digest::update(&mut h, p);
    }
    h.finalize().into()
}

pub fn seal(msg: &[u8], recipient_x: &[u8; 32], eph: [u8; 32]) -> Result<Vec<u8>, String> {
    let esk = SecretKey::from_bytes(eph);
    let epk = esk.public_key();
    let rpk = PublicKey::from(*recipient_x);
    let mut nonce = [0u8; 24];
    let mut h = Blake2bVar::new(24).map_err(|e| e.to_string())?;
    blake2::digest::Update::update(&mut h, epk.as_bytes());
    blake2::digest::Update::update(&mut h, recipient_x);
    h.finalize_variable(&mut nonce).map_err(|e| e.to_string())?;
    let ct = SalsaBox::new(&rpk, &esk).encrypt(&nonce.into(), msg).map_err(|_| "seal failed".to_string())?;
    let mut out = epk.as_bytes().to_vec();
    out.extend(ct);
    Ok(out)
}

/// Open a sealed box with the recipient's ed25519 seed (used by tests; the browser does this in `card.ts`).
pub fn open(sealed: &[u8], ed_seed: &[u8; 32]) -> Result<Vec<u8>, String> {
    if sealed.len() < 32 + 16 {
        return Err("sealed box too short".into());
    }
    let h = sha2::Sha512::digest(ed_seed);
    let mut sk = [0u8; 32];
    sk.copy_from_slice(&h[..32]);
    sk[0] &= 248;
    sk[31] &= 127;
    sk[31] |= 64;
    let rsk = SecretKey::from_bytes(sk);
    let rpk = rsk.public_key();
    let epk: [u8; 32] = sealed[..32].try_into().unwrap();
    let mut nonce = [0u8; 24];
    let mut hh = Blake2bVar::new(24).map_err(|e| e.to_string())?;
    blake2::digest::Update::update(&mut hh, &epk);
    blake2::digest::Update::update(&mut hh, rpk.as_bytes());
    hh.finalize_variable(&mut nonce).map_err(|e| e.to_string())?;
    SalsaBox::new(&PublicKey::from(epk), &rsk).decrypt(&nonce.into(), &sealed[32..]).map_err(|_| "open failed".into())
}
