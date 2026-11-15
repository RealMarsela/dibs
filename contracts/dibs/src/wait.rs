//! Waitlist reservations with a 60-minute hold. The reservation time lives in raw storage
//! (`wr:<trip>:<slot byte>` -> u64 LE ns) so the borsh layout of `Trip` and of `Dibs` is unchanged.
//! A reservation with no stored time (made before this upgrade) counts as expired.
use crate::types::*;
use crate::util::*;
use crate::*;
use near_sdk::json_types::U64;
use near_sdk::near;

/// How long an unpaid waitlist reservation blocks its slot.
pub const WAIT_HOLD_NS: u64 = 60 * 60 * 1_000_000_000;

fn wr_key(trip: &str, slot: u8) -> Vec<u8> {
    let mut k = Vec::with_capacity(trip.len() + 5);
    k.extend_from_slice(b"wr:");
    k.extend_from_slice(trip.as_bytes());
    k.push(b':');
    k.push(slot);
    k
}

pub(crate) fn wr_get(trip: &str, slot: u8) -> Option<u64> {
    let v = env::storage_read(&wr_key(trip, slot))?;
    <[u8; 8]>::try_from(v.as_slice()).ok().map(u64::from_le_bytes)
}

fn wr_set(trip: &str, slot: u8) {
    env::storage_write(&wr_key(trip, slot), &env::block_timestamp().to_le_bytes());
}

fn expired(trip: &str, slot: u8) -> bool {
    match wr_get(trip, slot) {
        Some(at) => at.saturating_add(WAIT_HOLD_NS) <= env::block_timestamp(),
        None => true,
    }
}

fn funded(t: &Trip, slot: u8) -> bool {
    t.waitlist.iter().any(|w| w.slot == slot)
}

/// Free a slot and forget its reservation time.
pub(crate) fn clear_wait(t: &mut Trip, slot: u8) {
    t.wait_res[slot as usize - 1] = None;
    env::storage_remove(&wr_key(&t.code, slot));
}

/// Free a slot only while `buyer` still holds it (callbacks must never clear a newer reserver).
pub(crate) fn clear_wait_if(t: &mut Trip, slot: u8, buyer: &AccountId) {
    if t.wait_res[slot as usize - 1].as_ref() == Some(buyer) {
        clear_wait(t, slot);
    }
}

#[near]
impl Dibs {
    /// Reserve a waitlist account for a buyer, who then pays `price` to `w<slot>-<trip>.<dibs>` within the hold.
    /// An unfunded reservation older than `WAIT_HOLD_NS` (or one with no stored time) can be taken over.
    pub fn reserve_wait(&mut self, trip: String, slot: u8, buyer: AccountId) {
        let caller = env::predecessor_account_id();
        ensure(caller == buyer || self.is_relayer(&caller), "E_NOT_RELAYER");
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(slot >= 1 && slot <= t.n_wait, "E_NO_SLOT");
        match t.wait_res[slot as usize - 1].clone() {
            None => {}
            Some(cur) if cur == buyer => return,
            Some(prev) => {
                ensure(!funded(t, slot) && expired(&trip, slot), "E_SLOT_TAKEN");
                env::log_str(&format!(
                    "EVENT_JSON:{{\"event\":\"wait_takeover\",\"trip\":\"{}\",\"slot\":{},\"previous\":\"{}\",\"buyer\":\"{}\"}}",
                    trip, slot, prev, buyer
                ));
            }
        }
        t.wait_res[slot as usize - 1] = Some(buyer.clone());
        wr_set(&trip, slot);
        self.register_usdc(buyer);
    }

    /// Anyone may free an expired, unfunded reservation.
    pub fn release_expired_wait(&mut self, trip: String, slot: u8) {
        let t = self.trip_mut(&trip);
        ensure(slot >= 1 && slot <= t.n_wait, "E_NO_SLOT");
        ensure(t.wait_res[slot as usize - 1].is_some(), "E_NO_SLOT");
        ensure(!funded(t, slot), "E_FUNDED");
        ensure(expired(&trip, slot), "E_NOT_EXPIRED");
        clear_wait(t, slot);
    }

    /// `reserved_at` (ns since epoch) per waitlist slot; null when free or reserved before the hold existed.
    pub fn get_wait_holds(&self, trip: String) -> Vec<Option<U64>> {
        let n = self.get_trip(trip.clone()).n_wait;
        (1..=n).map(|s| wr_get(&trip, s).map(U64)).collect()
    }
}

#[cfg(test)]
mod tests;
