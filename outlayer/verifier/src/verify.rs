//! The `booking` operation: blob -> hash -> decrypt -> DKIM -> domain -> extract -> ground -> expectations.
use crate::canon::{parse_minor_units, sha256_hex, valid_date, valid_trip, Facts};
use crate::dkim::{self, DnsTxt};
use crate::http::Http;
use crate::nearai::{Attestation, Extractor};
use crate::{blob, mime, msg};
use serde::{Deserialize, Deserializer};

#[derive(Deserialize, Debug)]
pub struct Expect {
    pub check_in: String,
    pub check_out: String,
    pub guests: u32,
    /// Cap in 6-decimal base units (decimal string or number), same scale as the signed `total`.
    #[serde(deserialize_with = "u64_or_string")]
    pub max_total: u64,
    /// When set, the email must be in this currency; when absent any ISO currency is accepted (no FX).
    #[serde(default)]
    pub currency: Option<String>,
}

fn u64_or_string<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum N {
        S(String),
        U(u64),
    }
    match N::deserialize(d)? {
        N::U(n) => Ok(n),
        N::S(s) => s.trim().parse().map_err(|_| serde::de::Error::custom("max_total is not an integer")),
    }
}

#[derive(Deserialize, Debug)]
pub struct BookingInput {
    pub trip: String,
    pub blob_url: String,
    pub blob_sha256: String,
    pub expect: Expect,
}

pub struct Ctx<'a> {
    pub http: &'a dyn Http,
    pub dns: &'a dyn DnsTxt,
    pub extractor: &'a dyn Extractor,
    pub blob_key: [u8; 32],
    pub allowed_domains: &'a [&'a str],
}

#[derive(Debug, PartialEq)]
pub struct VerifyError {
    pub code: &'static str,
    pub message: String,
}

fn err<T>(code: &'static str, message: impl Into<String>) -> Result<T, VerifyError> {
    Err(VerifyError { code, message: message.into() })
}

/// The total, in the formats a mailer may print, must appear in the verified text.
fn total_appears(text: &str, cents: u64) -> bool {
    let (i, c) = (cents / 100, cents % 100);
    let digits = i.to_string();
    let grouped = |sep: char| {
        let mut out = String::new();
        for (n, ch) in digits.chars().enumerate() {
            if n > 0 && (digits.len() - n) % 3 == 0 {
                out.push(sep);
            }
            out.push(ch);
        }
        out
    };
    let mut forms = vec![];
    for int in [digits.clone(), grouped(','), grouped('.'), grouped(' '), grouped('\u{a0}')] {
        forms.push(format!("{int}.{c:02}"));
        forms.push(format!("{int},{c:02}"));
        if c == 0 {
            forms.push(int);
        }
    }
    forms.iter().any(|f| text.contains(f.as_str()))
}

pub fn verify_booking(input: &BookingInput, ctx: &Ctx) -> Result<(Facts, Option<Attestation>), VerifyError> {
    if !valid_trip(&input.trip) {
        return err("E_INPUT", "bad trip code");
    }
    let e = &input.expect;
    if !valid_date(&e.check_in) || !valid_date(&e.check_out) || e.check_in >= e.check_out {
        return err("E_INPUT", "bad expected dates");
    }
    if !input.blob_url.starts_with("https://") {
        return err("E_INPUT", "blob_url must be https");
    }
    let encrypted = ctx.http.get(&input.blob_url, &[("Accept-Encoding", "identity")]).map_err(|m| VerifyError { code: "E_BLOB_FETCH", message: m })?;
    blob::check_hash(&encrypted, &input.blob_sha256).map_err(|m| VerifyError { code: "E_BLOB_HASH", message: m })?;
    let eml = blob::decrypt(&encrypted, &ctx.blob_key).map_err(|m| VerifyError { code: "E_DECRYPT", message: m })?;
    let message = msg::parse(&eml).map_err(|m| VerifyError { code: "E_EML", message: m })?;

    let pass = dkim::verify(&message, ctx.dns).map_err(|m| VerifyError { code: "E_DKIM", message: m })?;
    let allowed = ctx.allowed_domains.iter().any(|a| pass.domain == *a || pass.domain.ends_with(&format!(".{a}")));
    if !allowed {
        return err("E_DOMAIN", format!("DKIM domain {} is not allowed", pass.domain));
    }

    let text = mime::body_text(&message);
    let ex = ctx.extractor.extract(&text).map_err(|m| VerifyError { code: "E_EXTRACT", message: m })?;
    let f = ex.facts;
    if !valid_date(&f.check_in) || !valid_date(&f.check_out) {
        return err("E_FACTS", "extracted dates are not YYYY-MM-DD");
    }
    let total = parse_minor_units(&f.total).map_err(|m| VerifyError { code: "E_FACTS", message: m })?;
    if f.booking_ref.trim().is_empty() || !text.contains(f.booking_ref.trim()) {
        return err("E_FACTS", "booking reference is not in the email");
    }
    if total == 0 || !total_appears(&text, total) {
        return err("E_FACTS", "total is not in the email");
    }
    let currency = f.currency.trim().to_ascii_uppercase();
    if currency.len() != 3 || !currency.bytes().all(|b| b.is_ascii_uppercase()) {
        return err("E_FACTS", "currency is not an ISO code");
    }
    if f.check_in != e.check_in || f.check_out != e.check_out {
        return err("E_DATES", format!("dates {}..{} do not match the trip", f.check_in, f.check_out));
    }
    if f.guests != e.guests {
        return err("E_GUESTS", format!("{} guests, trip has {}", f.guests, e.guests));
    }
    if let Some(want) = &e.currency {
        if currency != want.to_ascii_uppercase() {
            return err("E_CURRENCY", format!("email is in {currency}, trip expects {want}"));
        }
    }
    let total_units = total * 10_000;
    if total_units > e.max_total {
        return err("E_OVER_CAP", format!("total {total_units} is over the cap {}", e.max_total));
    }
    let facts = Facts {
        trip: input.trip.clone(),
        stay: f.stay.trim().chars().take(120).collect(),
        check_in: f.check_in,
        check_out: f.check_out,
        guests: f.guests,
        total: total_units.to_string(),
        currency,
        dkim_domain: pass.domain,
        eml_sha256: sha256_hex(&eml),
        booking_ref_hash: sha256_hex(f.booking_ref.trim().as_bytes()),
    };
    Ok((facts, ex.attestation))
}
