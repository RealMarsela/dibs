//! OutLayer-backed draw and booking proof, and the DAO payout chain.
use crate::types::*;
use crate::util::*;
use crate::*;
use near_sdk::{near, serde_json, Promise, PromiseResult};

const BOOKING: &str = "dibs-booking:v1:";
const VRF: &str = "dibs-vrf:v1:";
const G_REQ: Gas = Gas::from_tgas(150);

fn js(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_default()
}

type Resp = Option<OutResp>;

fn check_sig(key: Option<[u8; 32]>, message: &str, sig_hex: &str) -> Result<(), &'static str> {
    let key = key.ok_or("E_NO_KEY")?;
    let sig = hex_decode(sig_hex).and_then(|v| <[u8; 64]>::try_from(v).ok()).ok_or("E_BAD_SIG")?;
    if message.len() > 2048 || !env::ed25519_verify(&sig, message.as_bytes(), &key) {
        return Err("E_BAD_SIG");
    }
    Ok(())
}

fn out(r: &Resp) -> Result<&OutResp, &'static str> {
    r.as_ref().ok_or("E_NO_RESULT")
}

fn verify_vrf(key: Option<[u8; 32]>, t: &Trip, r: &Resp) -> Result<Vec<u8>, &'static str> {
    let o = out(r)?;
    let body = o.message.strip_prefix(VRF).ok_or("E_BAD_PREFIX")?;
    check_sig(key, &o.message, &o.signature)?;
    let f: VrfFacts = serde_json::from_str(body).map_err(|_| "E_BAD_FACTS")?;
    if f.trip != t.code {
        return Err("E_TRIP_MISMATCH");
    }
    if !is_hex64(&f.output_hex) {
        return Err("E_BAD_FACTS");
    }
    let seed = hex_decode(&f.output_hex).ok_or("E_BAD_FACTS")?;
    let mut order: Vec<u8> = (1..=t.n_beds).collect();
    for i in (1..order.len()).rev() {
        let mut h = seed.clone();
        h.push(i as u8);
        let d = env::sha256(&h);
        let j = (u32::from_le_bytes([d[0], d[1], d[2], d[3]]) as usize) % (i + 1);
        order.swap(i, j);
    }
    Ok(order)
}

fn verify_facts(key: Option<[u8; 32]>, domains: &[String], t: &Trip, message: &str, sig: &str) -> Result<Facts, &'static str> {
    let body = message.strip_prefix(BOOKING).ok_or("E_BAD_PREFIX")?;
    check_sig(key, message, sig)?;
    let f: Facts = serde_json::from_str(body).map_err(|_| "E_BAD_FACTS")?;
    if f.trip != t.code {
        return Err("E_TRIP_MISMATCH");
    }
    if !is_hex64(&f.eml_sha256) || !is_hex64(&f.booking_ref_hash) || f.currency.is_empty() || f.currency.len() > 8 {
        return Err("E_BAD_FACTS");
    }
    if f.guests != t.n_beds as u32 {
        return Err("E_GUESTS");
    }
    if f.total.0 > t.pot() {
        return Err("E_TOTAL");
    }
    if !domains.contains(&f.dkim_domain) {
        return Err("E_DOMAIN");
    }
    if f.check_in != t.check_in || f.check_out != t.check_out {
        return Err("E_DATES");
    }
    Ok(f)
}

#[near]
impl Dibs {
    /// Ask OutLayer for the draw seed. Anyone, once every bed is Paid.
    #[payable]
    pub fn request_draw(&mut self, trip: String) -> Promise {
        let dep = env::attached_deposit();
        ensure(dep >= MIN_RUN, "E_DEPOSIT");
        let t = self.trip_mut(&trip);
        ensure(!t.refunded, "E_REFUNDED");
        ensure(t.all_paid(), "E_NOT_FULL");
        ensure(!t.drawn_out, "E_DRAWN");
        ensure(!t.draw_pending, "E_PENDING");
        t.draw_pending = true;
        let input = ["{\"op\":\"vrf\",\"trip\":", &js(&trip), ",\"n\":", &t.n_beds.to_string(), "}"].concat();
        self.run(input, 30, dep).then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(40)).on_draw(
            trip,
            env::predecessor_account_id(),
            U128(dep.as_yoctonear()),
        ))
    }

    /// Booker (or a relayer acting for the inbox) submits the encrypted booking email; OutLayer verifies it and signs the facts.
    #[payable]
    pub fn submit_proof(&mut self, trip: String, blob_url: String, blob_sha256: String) -> Promise {
        let dep = env::attached_deposit();
        ensure(dep >= MIN_RUN, "E_DEPOSIT");
        ensure(blob_url.len() <= 512 && is_hex64(&blob_sha256), "E_BAD_ARGS");
        let caller = env::predecessor_account_id();
        let by_relayer = self.is_relayer(&caller);
        let t = self.trip_mut(&trip);
        // The DKIM-verified booking is the authority; the payout still goes only to the booker.
        ensure(caller == t.booker || by_relayer, "E_NOT_BOOKER");
        ensure(!t.refunded, "E_REFUNDED");
        ensure(env::block_timestamp() <= t.book_by.0, "E_DEADLINE");
        ensure(t.all_paid(), "E_NOT_FULL");
        ensure(t.proof.is_none(), "E_PROOF_EXISTS");
        ensure(!t.proof_pending, "E_PENDING");
        t.proof_pending = true;
        let input = [
            "{\"op\":\"booking\",\"trip\":", &js(&trip), ",\"blob_url\":", &js(&blob_url), ",\"blob_sha256\":", &js(&blob_sha256),
            ",\"expect\":{\"check_in\":", &js(&t.check_in), ",\"check_out\":", &js(&t.check_out),
            ",\"guests\":", &t.n_beds.to_string(), ",\"max_total\":", &js(&t.pot().to_string()), "}}",
        ]
        .concat();
        self.run(input, 60, dep).then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(100)).on_proof(
            trip,
            env::predecessor_account_id(),
            U128(dep.as_yoctonear()),
        ))
    }

    /// Dry check of a signed booking message: "OK" or the error code `on_proof` would store.
    pub fn check_proof(&self, trip: String, message: String, signature: String) -> String {
        let t = self.get_trip(trip);
        match verify_facts(self.verifier_key, &self.domains, &t, &message, &signature) {
            Ok(f) if self.used_refs.contains(&f.booking_ref_hash) => "E_REPLAY".to_string(),
            Ok(_) => "OK".to_string(),
            Err(c) => c.to_string(),
        }
    }

    pub fn on_draw(&mut self, trip: String, caller: AccountId, deposit: U128) -> bool {
        require_self();
        let r: Resp = promise_json::<Resp>().flatten();
        self.refund_run(caller, deposit.0);
        let res = verify_vrf(self.verifier_key, &self.get_trip(trip.clone()), &r);
        let t = self.trip_mut(&trip);
        t.draw_pending = false;
        match res {
            Ok(order) => {
                t.drawn = Some(order);
                t.drawn_out = true;
                t.last_error.clear();
                true
            }
            Err(c) => {
                t.last_error = c.to_string();
                log_event("draw_refused", &trip, c);
                false
            }
        }
    }

    pub fn on_proof(&mut self, trip: String, caller: AccountId, deposit: U128) -> bool {
        require_self();
        let r: Resp = promise_json::<Resp>().flatten();
        self.refund_run(caller, deposit.0);
        let t = self.get_trip(trip.clone());
        let res = match out(&r) {
            Err(c) => Err(c),
            Ok(o) => verify_facts(self.verifier_key, &self.domains, &t, &o.message, &o.signature),
        };
        let res = match res {
            Ok(f) if self.used_refs.contains(&f.booking_ref_hash) => Err("E_REPLAY"),
            x => x,
        };
        match res {
            Ok(f) => {
                self.used_refs.insert(f.booking_ref_hash.clone());
                let (booker, dao, total) = (t.booker.clone(), t.dao.clone(), f.total);
                let desc = ["Dibs ", &trip, ": pay the booker against proof ", &f.booking_ref_hash[..8]].concat();
                let t = self.trip_mut(&trip);
                t.proof_pending = false;
                t.proof = Some(f);
                t.last_error.clear();
                self.add_payout(trip, dao, booker, total, desc);
                true
            }
            Err(c) => {
                let t = self.trip_mut(&trip);
                t.proof_pending = false;
                t.last_error = c.to_string();
                log_event("proof_refused", &trip, c);
                false
            }
        }
    }

    pub fn on_added(&mut self, trip: String) {
        require_self();
        let id = promise_json::<u64>();
        let t = self.get_trip(trip.clone());
        let (Some(id), Some(f)) = (id, t.proof.as_ref()) else {
            self.trip_mut(&trip).last_error = "E_PAYOUT".to_string();
            return;
        };
        self.trip_mut(&trip).payout = Payout::Added(id);
        self.act(&t.dao, id, &t.booker, f.total, trip);
    }

    pub fn on_acted(&mut self, trip: String, id: u64) {
        require_self();
        let failed = !matches!(env::promise_result(0), PromiseResult::Successful(_));
        let t = self.trip_mut(&trip);
        if failed {
            t.last_error = "E_PAYOUT".to_string();
            return;
        }
        t.payout = Payout::Acted(id);
        let dao = t.dao.clone();
        // the DAO swallows a failed ft_transfer into proposal status Failed: read it back
        ext_dao::ext(dao).with_static_gas(G_FT).get_proposal(id).then(Self::ext(env::current_account_id()).with_static_gas(G_FT).on_checked(trip));
    }

    pub fn on_checked(&mut self, trip: String) {
        require_self();
        let p = promise_json::<ProposalOut>();
        let t = self.trip_mut(&trip);
        match p {
            Some(p) if p.status == "Approved" => {
                t.payout = Payout::Done;
                t.last_error.clear();
            }
            _ => t.last_error = "E_PAYOUT".to_string(),
        }
    }

    /// Anyone can re-run a stuck payout (add or act step) once a proof is accepted.
    pub fn retry_payout(&mut self, trip: String) {
        let t = self.get_trip(trip.clone());
        let f = t.proof.clone().unwrap_or_else(|| fail("E_NOT_PAID"));
        match t.payout {
            Payout::Done => fail("E_ALREADY_PAID"),
            Payout::None => self.add_payout(trip, t.dao, t.booker, f.total, "Dibs payout retry".to_string()),
            Payout::Added(id) | Payout::Acted(id) => self.act(&t.dao, id, &t.booker, f.total, trip),
        };
    }
}

impl Dibs {
    fn run(&self, input: String, secs: u32, dep: NearToken) -> Promise {
        let args = [
            "{\"source\":{\"Project\":{\"project_id\":", &js(&self.project_id), ",\"version_key\":null}},\"input_data\":", &js(&input),
            ",\"resource_limits\":{\"max_instructions\":2000000000,\"max_memory_mb\":128,\"max_execution_seconds\":",
            &secs.to_string(), "},\"response_format\":\"Json\"}",
        ]
        .concat();
        Promise::new(self.outlayer.clone()).function_call("request_execution".to_string(), args.into_bytes(), dep, G_REQ)
    }

    fn refund_run(&self, caller: AccountId, deposit: u128) {
        let back = deposit.saturating_sub(self.run_fee);
        if back > 0 {
            Promise::new(caller).transfer(NearToken::from_yoctonear(back));
        }
    }

    pub(crate) fn transfer_kind(&self, to: &AccountId, amount: U128) -> ProposalKind {
        ProposalKind::Transfer(TransferKind { token_id: self.usdc.clone(), receiver_id: to.clone(), amount, msg: None })
    }

    pub(crate) fn add_payout(&self, trip: String, dao: AccountId, to: AccountId, total: U128, description: String) -> Promise {
        let p = ProposalIn { description, kind: self.transfer_kind(&to, total) };
        ext_dao::ext(dao).with_static_gas(G_FT).add_proposal(p).then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(80)).on_added(trip))
    }

    pub(crate) fn act(&self, dao: &AccountId, id: u64, to: &AccountId, total: U128, trip: String) -> Promise {
        ext_dao::ext(dao.clone())
            .with_static_gas(Gas::from_tgas(60))
            .act_proposal(id, "VoteApprove".to_string(), self.transfer_kind(to, total))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(40)).on_acted(trip, id))
    }
}
