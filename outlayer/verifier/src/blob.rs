//! Encrypted booking blob: `iv(12) || ciphertext || tag(16)`, AES-256-GCM (WebCrypto layout).
//! `blob_sha256` is the hash of the stored (encrypted) bytes; `eml_sha256` is the hash of the plaintext.
use crate::canon::sha256_hex;
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};

pub const MAX_BLOB: usize = 3 * 1024 * 1024;

/// Key from `DIBS_BLOB_KEY`: 64 hex chars or base64 of 32 bytes.
pub fn parse_key(s: &str) -> Result<[u8; 32], String> {
    let s = s.trim();
    let bytes = hex::decode(s).or_else(|_| STANDARD.decode(s)).map_err(|_| "DIBS_BLOB_KEY is not hex or base64")?;
    bytes.try_into().map_err(|_| "DIBS_BLOB_KEY must be 32 bytes".to_string())
}

pub fn check_hash(blob: &[u8], expected_hex: &str) -> Result<(), String> {
    if blob.len() > MAX_BLOB {
        return Err("blob too large".into());
    }
    if sha256_hex(blob) != expected_hex.to_ascii_lowercase() {
        return Err("blob sha256 mismatch".into());
    }
    Ok(())
}

pub fn decrypt(blob: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if blob.len() < 12 + 16 {
        return Err("blob too short".into());
    }
    let (iv, ct) = blob.split_at(12);
    Aes256Gcm::new(key.into()).decrypt(Nonce::from_slice(iv), ct).map_err(|_| "decrypt failed (wrong key or tampered blob)".into())
}
