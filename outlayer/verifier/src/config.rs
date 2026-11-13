//! Which senders count as proof, and the testnet fixture record.

/// Real mailers whose DKIM signature may back a booking (From must align with the signing domain).
pub const MAINNET_DOMAINS: &[&str] = &["booking.com", "airbnb.com", "hostelworld.com"];

/// Testnet-only fixture domain. Its private key is published in tests/fixtures, so anyone can mint a
/// "proof" for it: it is compiled in only with `--features test-domain` and never in the mainnet wasm.
pub const TEST_DOMAIN: &str = "dibs-test.example";
pub const TEST_DNS_NAME: &str = "dibs-test._domainkey.dibs-test.example";
pub const TEST_DNS_RECORD: &str = "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnuWr+yJI3MXoh/nKp0/SCCZvmf3Kcmz4vWYSp1f4JFFlKpWWogJb5Rl+ZWx1LVTKfzICqlnvsJKjm+aEGGlfd2snP/0PLO/4ULmBkYe5kQ8tumhlv98FCeNo/p8laxWdOmpPUV9dmRKCpwTz6+LE8qppG+KwfjMR2mWSivcfwP0ZsNI5DwUyMXyju259QiFJhD6/QzIm8/t1eLEuHu5RyL55Cxp7io56ifTH2IoaFSlha0PEJJ1NVepNW1q7nc62jZmSZHRJpO2zHO4PkbNGdkmtul80i0J0grSmq9lCc01mVM7bo17xPpTMF7Bq2+nKLij9hvt2HuLX8MeJCE3VHQIDAQAB";

pub fn allowed_domains() -> Vec<&'static str> {
    let mut v = MAINNET_DOMAINS.to_vec();
    if cfg!(feature = "test-domain") {
        v.push(TEST_DOMAIN);
    }
    v
}

pub fn fixture_record() -> Option<(&'static str, &'static str)> {
    cfg!(feature = "test-domain").then_some((TEST_DNS_NAME, TEST_DNS_RECORD))
}
