//! Dibs: one contract for every group trip. See ../INTERFACE.md.
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, LookupSet};
use near_sdk::{env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault};

mod oracle;
mod pay;
mod refund;
mod trip;
mod types;
mod util;

use types::*;
use util::*;

pub const BED_WASM: &[u8] = include_bytes!(env!("DIBS_BED_PATH"));
pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
/// USDC storage registration (min = max on the NEP-141 standard).
pub const STORAGE: NearToken = NearToken::from_yoctonear(1_250_000_000_000_000_000_000);
pub const MIN_RUN: NearToken = NearToken::from_millinear(20);
pub const G_FT: Gas = Gas::from_tgas(15);
pub const G_CB: Gas = Gas::from_tgas(20);

#[ext_contract(ext_ft)]
pub trait Ft {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>);
}

#[ext_contract(ext_dao)]
pub trait Dao {
    fn add_proposal(&mut self, proposal: ProposalIn) -> u64;
    fn act_proposal(&mut self, id: u64, action: String, proposal: ProposalKind);
    fn get_proposal(&self, id: u64) -> ProposalOut;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Dibs {
    owner: AccountId,
    usdc: AccountId,
    outlayer: AccountId,
    project_id: String,
    verifier_key: Option<[u8; 32]>,
    domains: Vec<String>,
    relayers: Vec<AccountId>,
    run_fee: u128,
    trips: LookupMap<String, Trip>,
    used_refs: LookupSet<String>,
}

#[near]
impl Dibs {
    #[init]
    pub fn new(owner: AccountId, usdc: AccountId, outlayer: AccountId, project_id: String, domains: Vec<String>, run_fee: U128) -> Self {
        Self {
            owner,
            usdc,
            outlayer,
            project_id,
            verifier_key: None,
            domains,
            relayers: Vec::new(),
            run_fee: run_fee.0,
            trips: LookupMap::new(b"t"),
            used_refs: LookupSet::new(b"r"),
        }
    }

    fn only_owner(&self) {
        ensure(env::predecessor_account_id() == self.owner, "E_NOT_OWNER");
    }

    /// Pin the OutLayer project's ed25519 public key (32 bytes, hex).
    pub fn set_verifier_key(&mut self, key_hex: String) {
        self.only_owner();
        let k = hex_decode(&key_hex).and_then(|v| <[u8; 32]>::try_from(v).ok());
        self.verifier_key = Some(k.unwrap_or_else(|| fail("E_BAD_ARGS")));
    }

    pub fn set_domains(&mut self, domains: Vec<String>) {
        self.only_owner();
        self.domains = domains;
    }

    pub fn add_relayer(&mut self, account: AccountId) {
        self.only_owner();
        if !self.relayers.contains(&account) {
            self.relayers.push(account);
        }
    }

    pub fn set_run_fee(&mut self, run_fee: U128) {
        self.only_owner();
        self.run_fee = run_fee.0;
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            usdc: self.usdc.clone(),
            outlayer: self.outlayer.clone(),
            project_id: self.project_id.clone(),
            verifier_key: self.verifier_key.map(|k| near_sdk::bs58::encode(k).into_string()),
            domains: self.domains.clone(),
            relayers: self.relayers.clone(),
            run_fee: U128(self.run_fee),
        }
    }

    pub fn get_trip(&self, trip: String) -> Trip {
        self.trips.get(&trip).cloned().unwrap_or_else(|| fail("E_NO_TRIP"))
    }

    pub fn get_bed(&self, trip: String, n: u8) -> Bed {
        let t = self.get_trip(trip);
        ensure(n >= 1 && n <= t.n_beds, "E_BAD_ARGS");
        t.beds[n as usize - 1].clone()
    }

    pub fn get_waitlist(&self, trip: String) -> Vec<WaitEntry> {
        self.get_trip(trip).waitlist
    }
}

impl Dibs {
    pub(crate) fn trip_mut(&mut self, code: &str) -> &mut Trip {
        self.trips.get_mut(&code.to_string()).unwrap_or_else(|| fail("E_NO_TRIP"))
    }

    pub(crate) fn is_relayer(&self, a: &AccountId) -> bool {
        *a == self.owner || self.relayers.contains(a)
    }

    pub(crate) fn pay_usdc(&self, to: AccountId, amount: u128) -> near_sdk::Promise {
        ext_ft::ext(self.usdc.clone()).with_attached_deposit(ONE_YOCTO).with_static_gas(G_FT).ft_transfer(to, U128(amount), None)
    }

    pub(crate) fn register_usdc(&self, who: AccountId) -> near_sdk::Promise {
        ext_ft::ext(self.usdc.clone()).with_attached_deposit(STORAGE).with_static_gas(Gas::from_tgas(8)).storage_deposit(Some(who), Some(true))
    }
}
