//! Lithic sandbox client over the `Http` seam. The API key is a sealed secret and is only ever placed in
//! the Authorization header; it never appears in an error string or output.
use crate::http::Http;
use serde_json::{json, Value};

pub const SANDBOX_ROOT: &str = "https://sandbox.lithic.com";
pub const LODGING_MCC: &str = "7011";

#[derive(Debug, Clone, PartialEq)]
pub struct Card {
    pub token: String,
    pub last4: String,
    pub pan: String,
    pub cvv: String,
    pub exp_month: String,
    pub exp_year: String,
}

pub struct Lithic<'a> {
    pub http: &'a dyn Http,
    pub key: &'a str,
    pub root: &'a str,
}

impl Lithic<'_> {
    fn post(&self, path: &str, idem: &str, body: &Value) -> Result<Value, String> {
        let url = format!("{}{}", self.root, path);
        let bytes = serde_json::to_vec(body).map_err(|e| e.to_string())?;
        let h = [("Authorization", self.key), ("Content-Type", "application/json"), ("Idempotency-Key", idem)];
        let raw = self.http.post(&url, &h, &bytes).map_err(|e| format!("lithic {path}: {e}"))?;
        serde_json::from_slice(&raw).map_err(|e| format!("lithic {path}: bad json: {e}"))
    }

    fn card_of(v: &Value) -> Result<Card, String> {
        let s = |k: &str| v.get(k).and_then(Value::as_str).map(str::to_string).ok_or_else(|| format!("lithic card: missing {k}"));
        Ok(Card { token: s("token")?, last4: s("last_four")?, pan: s("pan")?, cvv: s("cvv")?, exp_month: s("exp_month")?, exp_year: s("exp_year")? })
    }

    /// One SINGLE_USE card whose limit is the pot. The idempotency key is the trip code, so a retry returns
    /// the same card. Once the card has been modified (the lodging rule is attached) Lithic answers the replay
    /// with 409 naming the card; that card is read back, and only adopted if its memo is this trip's.
    pub fn create_card(&self, trip: &str, cents: u64) -> Result<Card, String> {
        let memo = format!("dibs {trip}");
        let body = json!({"type": "SINGLE_USE", "spend_limit": cents, "memo": memo, "state": "OPEN"});
        match self.post("/v1/cards", &format!("dibs-card-{trip}"), &body) {
            Ok(v) => Self::card_of(&v),
            Err(e) => {
                let token = conflicting_rule(&e).ok_or(e)?;
                let raw = self.http.get(&format!("{}/v1/cards/{token}", self.root), &[("Authorization", self.key)]).map_err(|e| format!("lithic card read: {e}"))?;
                let v: Value = serde_json::from_slice(&raw).map_err(|e| format!("lithic card read: {e}"))?;
                if v.get("memo").and_then(Value::as_str) != Some(memo.as_str()) || v.get("spend_limit").and_then(Value::as_u64) != Some(cents) {
                    return Err("lithic card: the conflicting card is not this trip's card".into());
                }
                Self::card_of(&v)
            }
        }
    }

    fn rule_state(&self, token: &str) -> Result<String, String> {
        let h = [("Authorization", self.key)];
        let raw = self.http.get(&format!("{}/v2/auth_rules/{token}", self.root), &h).map_err(|e| format!("lithic rule read: {e}"))?;
        let v: Value = serde_json::from_slice(&raw).map_err(|e| format!("lithic rule read: {e}"))?;
        Ok(v.get("state").and_then(Value::as_str).unwrap_or("").to_string())
    }

    /// Auth Rule (v2): decline every authorization whose MCC is not 7011, attached to this card, then promote
    /// the draft so it is enforced. Returns the rule token.
    pub fn lodging_only(&self, card_token: &str, trip: &str) -> Result<String, String> {
        let body = json!({
            "type": "CONDITIONAL_ACTION", "event_stream": "AUTHORIZATION", "name": format!("dibs lodging only {trip}"),
            "card_tokens": [card_token],
            "parameters": {"action": "DECLINE", "conditions": [{"attribute": "MCC", "operation": "IS_NOT_ONE_OF", "value": [LODGING_MCC]}]},
        });
        let token = match self.post("/v2/auth_rules", &format!("dibs-rule-{trip}"), &body) {
            Ok(v) => v.get("token").and_then(Value::as_str).ok_or("lithic rule: missing token")?.to_string(),
            // A retry for the same trip: Lithic answers 409 {"conflicts_with":"<rule token>"}; adopt that rule.
            Err(e) => conflicting_rule(&e).ok_or(e)?,
        };
        if self.rule_state(&token)? != "ACTIVE" {
            let p = self.post(&format!("/v2/auth_rules/{token}/promote"), &format!("dibs-promote-{trip}"), &json!({}))?;
            if p.get("state").and_then(Value::as_str) != Some("ACTIVE") {
                return Err("lithic rule: promote did not reach ACTIVE".into());
            }
        }
        Ok(token)
    }
}

/// Pull the existing resource's token out of a 409 error body (`"conflicts_with": "<uuid>"`, spacing varies).
pub fn conflicting_rule(err: &str) -> Option<String> {
    if !err.contains("HTTP 409") {
        return None;
    }
    let tail = err.split("\"conflicts_with\"").nth(1)?;
    let t = tail.split('"').nth(1)?;
    (t.len() == 36 && t.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')).then(|| t.to_string())
}
