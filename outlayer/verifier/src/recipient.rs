//! Optional "to_trip" signal: the DKIM-verified message was addressed to `<trip>@dibs.larinova.com`.
//! It is an extra top-level JSON field, never part of the signed message, so the contract interface is unchanged.
use crate::msg::Message;

pub const MAIL_DOMAIN: &str = "dibs.larinova.com";
const HEADERS: [&str; 3] = ["to", "delivered-to", "x-original-to"];

fn is_local_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'%' | b'+' | b'-')
}

/// True when `value` holds the exact address `<trip>@<domain>` (case-insensitive, not as part of a longer address).
fn has_address(value: &str, trip: &str, domain: &str) -> bool {
    let value = value.to_ascii_lowercase();
    let needle = format!("{}@{}", trip.to_ascii_lowercase(), domain);
    let bytes = value.as_bytes();
    value.match_indices(&needle).any(|(i, _)| {
        let before_ok = i == 0 || !is_local_char(bytes[i - 1]);
        let after = i + needle.len();
        let after_ok = after >= bytes.len() || !(bytes[after].is_ascii_alphanumeric() || matches!(bytes[after], b'.' | b'-' | b'_'));
        before_ok && after_ok
    })
}

pub fn addressed_to_trip(msg: &Message, trip: &str) -> bool {
    msg.headers.iter().filter(|h| HEADERS.iter().any(|n| h.name.eq_ignore_ascii_case(n))).any(|h| has_address(&h.value(), trip, MAIL_DOMAIN))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(headers: &str) -> Message {
        crate::msg::parse(format!("{headers}\r\n\r\nbody\r\n").as_bytes()).unwrap()
    }

    #[test]
    fn matches_the_trip_address_in_to_or_delivered_to() {
        assert!(addressed_to_trip(&msg("To: Crew <lis0312@dibs.larinova.com>"), "lis0312"));
        assert!(addressed_to_trip(&msg("To: a@example.org, LIS0312@Dibs.Larinova.com"), "lis0312"));
        assert!(addressed_to_trip(&msg("From: x@booking.com\r\nDelivered-To: lis0312@dibs.larinova.com"), "lis0312"));
        assert!(addressed_to_trip(&msg("To: a@example.org,\r\n lis0312@dibs.larinova.com"), "lis0312"));
    }

    #[test]
    fn refuses_other_trips_domains_and_look_alikes() {
        assert!(!addressed_to_trip(&msg("To: lis0312@dibs.larinova.com"), "par0101"));
        assert!(!addressed_to_trip(&msg("To: lis0312@larinova.com"), "lis0312"));
        assert!(!addressed_to_trip(&msg("To: lis0312@dibs.larinova.com.evil.example"), "lis0312"));
        assert!(!addressed_to_trip(&msg("To: xlis0312@dibs.larinova.com"), "lis0312"));
        assert!(!addressed_to_trip(&msg("To: lis0312@sub.dibs.larinova.com"), "lis0312"));
        assert!(!addressed_to_trip(&msg("To: crew@example.org"), "lis0312"));
        // the address only in the body or an unrelated header does not count
        assert!(!addressed_to_trip(&msg("Subject: lis0312@dibs.larinova.com\r\nTo: crew@example.org"), "lis0312"));
    }
}
