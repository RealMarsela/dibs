use crate::types::*;
use crate::util::*;
use crate::*;
use near_sdk::json_types::U64;
use near_sdk::{near, Promise};

const ACCOUNT_BASE: u128 = 100;
const BYTE: u128 = 10_000_000_000_000_000_000;
const BUFFER: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR per account for 1-yocto calls
const STATE_FEE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR for the trip record
const HOLDER_REG: u128 = 2_500_000_000_000_000_000_000; // two USDC registrations per bed, paid from the contract

fn cost(n_beds: u8, n_wait: u8) -> u128 {
    let accts = n_beds as u128 + n_wait as u128;
    accts * ((BED_WASM.len() as u128 + ACCOUNT_BASE) * BYTE + BUFFER + STORAGE.as_yoctonear() + HOLDER_REG)
        + 2 * STORAGE.as_yoctonear()
        + STATE_FEE
}

#[near]
impl Dibs {
    pub fn create_cost(&self, n_beds: u8, n_wait: u8) -> U128 {
        U128(cost(n_beds, n_wait))
    }

    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn create_trip(
        &mut self,
        code: String,
        price: U128,
        n_beds: u8,
        n_wait: Option<u8>,
        book_by: U64,
        booker: AccountId,
        dao: AccountId,
        check_in: String,
        check_out: String,
        stay: Option<String>,
    ) -> U128 {
        let n_wait = n_wait.unwrap_or(2);
        ensure(code_ok(&code), "E_BAD_ARGS");
        ensure(!self.trips.contains_key(&code), "E_TRIP_EXISTS");
        ensure(price.0 > 0 && (1..=16).contains(&n_beds) && n_beds as u16 + n_wait as u16 <= 20, "E_BAD_ARGS");
        ensure(date_ok(&check_in) && date_ok(&check_out) && check_in < check_out, "E_BAD_ARGS");
        ensure(book_by.0 > env::block_timestamp(), "E_BAD_ARGS");
        let need = cost(n_beds, n_wait);
        let dep = env::attached_deposit().as_yoctonear();
        ensure(dep >= need, "E_DEPOSIT");

        let per = (BED_WASM.len() as u128 + ACCOUNT_BASE) * BYTE + BUFFER;
        let mut all: Vec<(char, u8)> = (1..=n_beds).map(|i| ('b', i)).collect();
        all.extend((1..=n_wait).map(|i| ('w', i)));
        for (k, i) in all {
            let id = slot_id(k, i, &code);
            Promise::new(id.clone())
                .create_account()
                .transfer(NearToken::from_yoctonear(per))
                .deploy_contract(BED_WASM.to_vec());
            self.register_usdc(id);
        }
        self.register_usdc(dao.clone());
        self.register_usdc(booker.clone());

        let bed = Bed { holder: None, buyer: None, status: Status::Open, paid_from_chain: String::new() };
        self.trips.insert(
            code.clone(),
            Trip {
                code,
                price,
                n_beds,
                n_wait,
                book_by,
                booker,
                dao,
                check_in,
                check_out,
                stay: stay.unwrap_or_default(),
                beds: vec![bed; n_beds as usize],
                wait_res: vec![None; n_wait as usize],
                waitlist: Vec::new(),
                proof: None,
                payout: Payout::None,
                proof_pending: false,
                draw_pending: false,
                drawn: None,
                drawn_out: false,
                refunded: false,
                refund_cursor: 0,
                last_error: String::new(),
            },
        );
        let extra = dep - need;
        if extra > 0 {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(extra));
        }
        U128(need)
    }

    /// Open -> Held (or reserve a Listed bed for a resale buyer). Holder or relayer only.
    pub fn hold(&mut self, trip: String, n: u8, holder: AccountId) {
        let caller = env::predecessor_account_id();
        ensure(caller == holder || self.is_relayer(&caller), "E_NOT_RELAYER");
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(n >= 1 && n <= t.n_beds, "E_BAD_ARGS");
        let b = &mut t.beds[n as usize - 1];
        match b.status {
            Status::Open => {
                b.status = Status::Held;
                b.holder = Some(holder.clone());
            }
            Status::Listed if b.buyer.is_none() => b.buyer = Some(holder.clone()),
            Status::Held => fail("E_ALREADY_HELD"),
            _ => fail("E_ALREADY_PAID"),
        }
        self.register_usdc(holder);
    }

    /// Held -> Open (or drop a resale reservation). Reserver only; never touches paid beds.
    pub fn release_hold(&mut self, trip: String, n: u8) {
        let caller = env::predecessor_account_id();
        let t = self.trip_mut(&trip);
        ensure(n >= 1 && n <= t.n_beds, "E_BAD_ARGS");
        let b = &mut t.beds[n as usize - 1];
        if b.status == Status::Held && b.holder.as_ref() == Some(&caller) {
            b.status = Status::Open;
            b.holder = None;
        } else if b.status == Status::Listed && b.buyer.as_ref() == Some(&caller) {
            b.buyer = None;
        } else {
            fail("E_NOT_HOLDER");
        }
    }

    /// There is no refund path. This method exists so the demo can show the refusal.
    pub fn request_refund(&self, trip: String, n: u8) {
        let _ = (trip, n);
        fail("E_NO_REFUND");
    }

    /// Relayer note: which chain the bed's payment came from (display only).
    pub fn set_paid_from(&mut self, trip: String, n: u8, chain: String) {
        ensure(self.is_relayer(&env::predecessor_account_id()), "E_NOT_RELAYER");
        ensure(chain.len() <= 24, "E_BAD_ARGS");
        let t = self.trip_mut(&trip);
        ensure(n >= 1 && n <= t.n_beds, "E_BAD_ARGS");
        t.beds[n as usize - 1].paid_from_chain = chain;
    }

    /// Reserve a waitlist account for a buyer, who then pays `price` to `w<slot>-<trip>.<dibs>`.
    pub fn reserve_wait(&mut self, trip: String, slot: u8, buyer: AccountId) {
        let caller = env::predecessor_account_id();
        ensure(caller == buyer || self.is_relayer(&caller), "E_NOT_RELAYER");
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(slot >= 1 && slot <= t.n_wait, "E_NO_SLOT");
        ensure(t.wait_res[slot as usize - 1].is_none(), "E_SLOT_TAKEN");
        t.wait_res[slot as usize - 1] = Some(buyer.clone());
        self.register_usdc(buyer);
    }
}
