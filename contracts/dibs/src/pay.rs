use crate::types::*;
use crate::util::*;
use crate::*;
use near_sdk::{near, serde_json, PromiseOrValue, PromiseResult};

fn ok() -> bool {
    matches!(env::promise_result(0), PromiseResult::Successful(_))
}

#[near]
impl Dibs {
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        ensure(env::predecessor_account_id() == self.usdc, "E_NOT_USDC");
        let m: Msg = serde_json::from_str(&msg).unwrap_or_else(|_| fail("E_BAD_MSG"));
        let is_bed = m.kind == "bed";
        ensure(is_bed || m.kind == "wait", "E_BAD_MSG");
        ensure(sender_id == slot_id(if is_bed { 'b' } else { 'w' }, m.n, &m.trip), "E_BAD_SENDER");
        let t = self.trip_mut(&m.trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(amount.0 == t.price.0, "E_WRONG_AMOUNT");
        let dao = t.dao.clone();
        let (price, n) = (t.price.0, m.n);
        if is_bed {
            ensure(n >= 1 && n <= t.n_beds, "E_BAD_BED");
            let b = &mut t.beds[n as usize - 1];
            match b.status {
                Status::Held => {
                    b.status = Status::Paid;
                    let p = self.pay_usdc(dao, price);
                    return PromiseOrValue::Promise(p.then(Self::ext(env::current_account_id()).with_static_gas(G_CB).on_forward(m.trip, n)));
                }
                Status::Listed => {
                    let (prev, buyer) = (b.holder.clone(), b.buyer.clone());
                    let (prev, buyer) = (prev.unwrap_or_else(|| fail("E_NOT_HELD")), buyer.unwrap_or_else(|| fail("E_NOT_HELD")));
                    b.status = Status::Paid;
                    b.holder = Some(buyer.clone());
                    b.buyer = None;
                    let p = self.pay_usdc(prev.clone(), price);
                    return PromiseOrValue::Promise(
                        p.then(Self::ext(env::current_account_id()).with_static_gas(G_CB).on_resale(m.trip, n, prev, buyer)),
                    );
                }
                Status::Open => fail("E_NOT_HELD"),
                Status::Paid => fail("E_ALREADY_PAID"),
            }
        }
        // waitlist payment
        ensure(n >= 1 && n <= t.n_wait, "E_NO_SLOT");
        let buyer = t.wait_res[n as usize - 1].clone().unwrap_or_else(|| fail("E_NOT_HELD"));
        ensure(!t.waitlist.iter().any(|w| w.slot == n), "E_ALREADY_PAID");
        let entry = WaitEntry { buyer, slot: n };
        match Self::fill(t, entry.clone()) {
            Some((bed_n, seller)) => {
                let p = self.pay_usdc(seller.clone(), price);
                PromiseOrValue::Promise(p.then(
                    Self::ext(env::current_account_id()).with_static_gas(G_CB).on_fill(m.trip, bed_n, seller, entry, amount),
                ))
            }
            None => {
                t.waitlist.push(entry);
                PromiseOrValue::Value(U128(0))
            }
        }
    }

    /// Listed bed + waitlist entry: the entry becomes holder. Returns (bed number, seller).
    fn fill(t: &mut Trip, e: WaitEntry) -> Option<(u8, AccountId)> {
        let i = t.beds.iter().position(|b| b.status == Status::Listed && b.buyer.is_none())?;
        let b = &mut t.beds[i];
        let seller = b.holder.replace(e.buyer)?;
        b.status = Status::Paid;
        Some((i as u8 + 1, seller))
    }

    pub fn on_forward(&mut self, trip: String, n: u8) -> U128 {
        require_self();
        let t = self.trip_mut(&trip);
        if ok() {
            return U128(0);
        }
        t.beds[n as usize - 1].status = Status::Held;
        t.last_error = "E_FORWARD".to_string();
        t.price
    }

    pub fn on_resale(&mut self, trip: String, n: u8, prev: AccountId, buyer: AccountId) -> U128 {
        require_self();
        let t = self.trip_mut(&trip);
        if ok() {
            return U128(0);
        }
        let b = &mut t.beds[n as usize - 1];
        b.status = Status::Listed;
        b.holder = Some(prev);
        b.buyer = Some(buyer);
        t.last_error = "E_PAYOUT".to_string();
        t.price
    }

    /// `refund` is the amount to return to the waitlist account (non-zero when called from `ft_on_transfer`);
    /// zero when the entry came from the held queue.
    pub fn on_fill(&mut self, trip: String, n: u8, seller: AccountId, entry: WaitEntry, refund: U128) -> U128 {
        require_self();
        let t = self.trip_mut(&trip);
        if ok() {
            crate::wait::clear_wait_if(t, entry.slot, &entry.buyer);
            return U128(0);
        }
        let b = &mut t.beds[n as usize - 1];
        b.status = Status::Listed;
        b.holder = Some(seller);
        if refund.0 == 0 {
            t.waitlist.insert(0, entry);
        }
        t.last_error = "E_PAYOUT".to_string();
        refund
    }

    pub fn on_left(&mut self, trip: String, entry: WaitEntry) {
        require_self();
        let good = ok();
        let t = self.trip_mut(&trip);
        if good {
            crate::wait::clear_wait_if(t, entry.slot, &entry.buyer);
        } else {
            t.waitlist.push(entry);
            t.last_error = "E_PAYOUT".to_string();
        }
    }

    /// Paid -> Listed. With a funded waitlist the head fills the bed at once and pays the seller price.
    pub fn list_for_resale(&mut self, trip: String, n: u8) -> PromiseOrValue<U128> {
        let caller = env::predecessor_account_id();
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(n >= 1 && n <= t.n_beds, "E_BAD_ARGS");
        let b = &mut t.beds[n as usize - 1];
        ensure(b.holder.as_ref() == Some(&caller), "E_NOT_HOLDER");
        ensure(b.status == Status::Paid, "E_NOT_PAID");
        b.status = Status::Listed;
        if t.waitlist.is_empty() {
            return PromiseOrValue::Value(U128(0));
        }
        let entry = t.waitlist.remove(0);
        let price = t.price.0;
        let b = &mut t.beds[n as usize - 1];
        b.holder = Some(entry.buyer.clone());
        b.status = Status::Paid;
        let p = self.pay_usdc(caller.clone(), price);
        PromiseOrValue::Promise(p.then(Self::ext(env::current_account_id()).with_static_gas(G_CB).on_fill(trip, n, caller, entry, U128(0))))
    }

    /// Buyer leaves: a funded entry gets price back; a bare reservation is freed.
    pub fn leave_waitlist(&mut self, trip: String) -> PromiseOrValue<U128> {
        let caller = env::predecessor_account_id();
        let t = self.trip_mut(&trip);
        if let Some(i) = t.waitlist.iter().position(|w| w.buyer == caller) {
            let entry = t.waitlist.remove(i);
            let price = t.price.0;
            let p = self.pay_usdc(caller, price);
            return PromiseOrValue::Promise(p.then(Self::ext(env::current_account_id()).with_static_gas(G_CB).on_left(trip, entry)));
        }
        let i = t.wait_res.iter().position(|r| r.as_ref() == Some(&caller)).unwrap_or_else(|| fail("E_NO_SLOT"));
        crate::wait::clear_wait(t, i as u8 + 1);
        PromiseOrValue::Value(U128(0))
    }
}
