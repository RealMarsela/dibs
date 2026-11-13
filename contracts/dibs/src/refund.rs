use crate::types::*;
use crate::util::*;
use crate::*;
use near_sdk::{near, Promise};

#[near]
impl Dibs {
    /// After `book_by` with no accepted proof: refund `limit` bed holders through DAO Transfer proposals,
    /// then waitlist buyers directly. Call again until `refunded` is true.
    pub fn refund_all(&mut self, trip: String, limit: Option<u8>) -> u8 {
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(env::block_timestamp() > t.book_by.0, "E_BEFORE_DEADLINE");
        ensure(t.proof.is_none(), "E_PROOF_EXISTS");
        ensure(!t.proof_pending, "E_PENDING");
        let limit = limit.unwrap_or(2).clamp(1, 3);
        let (price, dao, mut left) = (t.price, t.dao.clone(), limit);
        let mut jobs: Vec<(String, AccountId)> = Vec::new();
        let mut direct: Vec<AccountId> = Vec::new();
        while left > 0 && t.refund_cursor < t.n_beds {
            let b = &t.beds[t.refund_cursor as usize];
            t.refund_cursor += 1;
            if matches!(b.status, Status::Paid | Status::Listed) {
                if let Some(h) = &b.holder {
                    jobs.push((["Dibs ", &trip, ": refund bed ", &t.refund_cursor.to_string()].concat(), h.clone()));
                    left -= 1;
                }
            }
        }
        while left > 0 && t.refund_cursor >= t.n_beds && !t.waitlist.is_empty() {
            direct.push(t.waitlist.remove(0).buyer);
            left -= 1;
        }
        let done = t.refund_cursor >= t.n_beds && t.waitlist.is_empty();
        if done {
            t.refunded = true;
        }
        for (description, holder) in jobs {
            let p = ProposalIn { description, kind: self.transfer_kind(&holder, price) };
            ext_dao::ext(dao.clone())
                .with_static_gas(G_FT)
                .add_proposal(p)
                .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(80)).on_refund_added(dao.clone(), holder, price));
        }
        for b in direct {
            self.pay_usdc(b, price.0);
        }
        limit - left
    }

    pub fn on_refund_added(&mut self, dao: AccountId, holder: AccountId, price: U128) -> Option<Promise> {
        require_self();
        let id = promise_json::<u64>()?;
        Some(ext_dao::ext(dao).with_static_gas(Gas::from_tgas(60)).act_proposal(id, "VoteApprove".to_string(), self.transfer_kind(&holder, price)))
    }
}
