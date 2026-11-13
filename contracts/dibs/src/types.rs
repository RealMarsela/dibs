use near_sdk::json_types::{U128, U64};
use near_sdk::{near, AccountId};

#[near(serializers=[borsh, json])]
#[derive(Clone, Copy, PartialEq)]
pub enum Status {
    Open,
    Held,
    Paid,
    Listed,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Bed {
    /// Holder (Paid/Listed), or the account that reserved the bed (Held).
    pub holder: Option<AccountId>,
    /// Reserved buyer of a Listed bed.
    pub buyer: Option<AccountId>,
    pub status: Status,
    pub paid_from_chain: String,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct WaitEntry {
    pub buyer: AccountId,
    pub slot: u8,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Facts {
    pub trip: String,
    pub stay: String,
    pub check_in: String,
    pub check_out: String,
    pub guests: u32,
    pub total: U128,
    pub currency: String,
    pub dkim_domain: String,
    pub eml_sha256: String,
    pub booking_ref_hash: String,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Copy, PartialEq)]
pub enum Payout {
    None,
    Added(u64),
    Acted(u64),
    Done,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Trip {
    pub code: String,
    pub price: U128,
    pub n_beds: u8,
    pub n_wait: u8,
    pub book_by: U64,
    pub booker: AccountId,
    pub dao: AccountId,
    pub check_in: String,
    pub check_out: String,
    pub stay: String,
    pub beds: Vec<Bed>,
    /// Reserved buyer per waitlist slot.
    pub wait_res: Vec<Option<AccountId>>,
    pub waitlist: Vec<WaitEntry>,
    pub proof: Option<Facts>,
    pub payout: Payout,
    pub proof_pending: bool,
    pub draw_pending: bool,
    pub drawn: Option<Vec<u8>>,
    pub drawn_out: bool,
    pub refunded: bool,
    pub refund_cursor: u8,
    pub last_error: String,
}

impl Trip {
    pub fn pot(&self) -> u128 {
        self.price.0 * self.n_beds as u128
    }
    pub fn all_paid(&self) -> bool {
        self.beds.iter().all(|b| b.status == Status::Paid)
    }
}

/// OutLayer output: `{"message":..., "signature":...}` (other fields ignored).
#[near(serializers=[json])]
pub struct OutResp {
    pub message: String,
    pub signature: String,
}

#[near(serializers=[json])]
pub struct Msg {
    pub kind: String,
    pub trip: String,
    pub n: u8,
}

#[near(serializers=[json])]
pub struct TransferKind {
    pub token_id: AccountId,
    pub receiver_id: AccountId,
    pub amount: U128,
    pub msg: Option<String>,
}

#[near(serializers=[json])]
pub enum ProposalKind {
    Transfer(TransferKind),
}

#[near(serializers=[json])]
pub struct ProposalIn {
    pub description: String,
    pub kind: ProposalKind,
}

#[near(serializers=[json])]
pub struct ProposalOut {
    pub status: String,
}

#[near(serializers=[json])]
pub struct VrfFacts {
    pub trip: String,
    pub output_hex: String,
}

#[near(serializers=[json])]
pub struct Config {
    pub owner: AccountId,
    pub usdc: AccountId,
    pub outlayer: AccountId,
    pub project_id: String,
    /// base58 of the 32-byte pinned key
    pub verifier_key: Option<String>,
    pub domains: Vec<String>,
    pub relayers: Vec<AccountId>,
    pub run_fee: U128,
}
