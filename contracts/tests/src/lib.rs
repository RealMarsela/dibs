//! Sandbox harness: usdc + mock OutLayer + dibs + a Sputnik DAO per trip.
use ed25519_dalek::{Signer, SigningKey};
use near_workspaces::network::Sandbox;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde_json::{json, Value};
use std::path::PathBuf;

pub mod report;

pub const PRICE: u128 = 250_000; // 0.25 USDC
pub const DAY_NS: u64 = 86_400_000_000_000;

pub fn contracts_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

pub fn wasm(name: &str) -> Vec<u8> {
    let p = if name.starts_with("sputnik") { contracts_dir().join("vendor").join(name) } else { contracts_dir().join("build/sandbox").join(name) };
    std::fs::read(&p).unwrap_or_else(|_| panic!("missing {p:?}: run scripts/build.sh sandbox and scripts/fetch-sputnik.sh"))
}

pub fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

pub fn sign(k: &SigningKey, message: &str) -> String {
    hex::encode(k.sign(message.as_bytes()).to_bytes())
}

pub fn text(r: &ExecutionFinalResult) -> String {
    format!("{r:?}")
}

pub struct Facts {
    pub trip: String,
    pub check_in: String,
    pub check_out: String,
    pub guests: u32,
    pub total: u128,
    pub domain: String,
    pub refhash: String,
}

impl Facts {
    pub fn ok(trip: &str, n: u32, total: u128) -> Self {
        Facts {
            trip: trip.into(),
            check_in: "2026-12-04".into(),
            check_out: "2026-12-07".into(),
            guests: n,
            total,
            domain: "booking.com".into(),
            refhash: "ab".repeat(32),
        }
    }

    /// Canonical message: exact key order, no whitespace.
    pub fn message(&self) -> String {
        format!(
            "dibs-booking:v1:{{\"trip\":\"{}\",\"stay\":\"Casa do Largo, Lisbon\",\"check_in\":\"{}\",\"check_out\":\"{}\",\"guests\":{},\"total\":\"{}\",\"currency\":\"EUR\",\"dkim_domain\":\"{}\",\"eml_sha256\":\"{}\",\"booking_ref_hash\":\"{}\"}}",
            self.trip, self.check_in, self.check_out, self.guests, self.total, self.domain, "cd".repeat(32), self.refhash
        )
    }
}

pub fn vrf_message(trip: &str, output_hex: &str) -> String {
    format!("dibs-vrf:v1:{{\"trip\":\"{trip}\",\"output_hex\":\"{output_hex}\"}}")
}

pub struct World {
    pub worker: Worker<Sandbox>,
    pub top: Account,
    pub usdc: Contract,
    pub dibs: Contract,
    pub outlayer: Contract,
    pub verifier: SigningKey,
    pub booker: Account,
    pub relayer: Account,
}

impl World {
    pub async fn new() -> anyhow::Result<World> {
        let worker = near_workspaces::sandbox().await?;
        let top = worker.root_account()?;
        let usdc = Self::deploy(&top, "usdc", "usdc_test.wasm", 20).await?;
        usdc.call("new").transact().await?.into_result()?;
        let outlayer = Self::deploy(&top, "outlayer", "mock_outlayer.wasm", 20).await?;
        outlayer.call("new").transact().await?.into_result()?;
        let dibs = Self::deploy(&top, "dibs", "dibs.wasm", 60).await?;
        let verifier = key(7);
        dibs.call("new")
            .args_json(json!({
                "owner": top.id(), "usdc": usdc.id(), "outlayer": outlayer.id(), "project_id": "dibs-owner.near/dibs-verifier",
                "domains": ["booking.com", "airbnb.com", "hostelworld.com", "dibs-test.example"], "run_fee": "3000000000000000000000"
            }))
            .transact()
            .await?
            .into_result()?;
        top.call(dibs.id(), "set_verifier_key")
            .args_json(json!({"key_hex": hex::encode(verifier.verifying_key().to_bytes())}))
            .transact()
            .await?
            .into_result()?;
        top.call(usdc.id(), "storage_deposit")
            .args_json(json!({"account_id": dibs.id(), "registration_only": true}))
            .deposit(NearToken::from_millinear(10))
            .transact()
            .await?
            .into_result()?;
        let booker = Self::user(&top, "booker").await?;
        let relayer = Self::user(&top, "relayer").await?;
        top.call(dibs.id(), "add_relayer").args_json(json!({"account": relayer.id()})).transact().await?.into_result()?;
        Ok(World { worker, top, usdc, dibs, outlayer, verifier, booker, relayer })
    }

    async fn deploy(top: &Account, name: &str, file: &str, near: u128) -> anyhow::Result<Contract> {
        let a = top.create_subaccount(name).initial_balance(NearToken::from_near(near)).transact().await?.into_result()?;
        Ok(a.deploy(&wasm(file)).await?.into_result()?)
    }

    pub async fn user(top: &Account, name: &str) -> anyhow::Result<Account> {
        Ok(top.create_subaccount(name).initial_balance(NearToken::from_near(20)).transact().await?.into_result()?)
    }

    pub async fn now_ns(&self) -> u64 {
        self.worker.view_block().await.unwrap().timestamp()
    }

    /// A Sputnik DAO whose only mover is dibs (role `trip`); the booker is crew and may only reject.
    pub async fn dao(&self, name: &str) -> anyhow::Result<Contract> {
        let d = Self::deploy(&self.top, name, "sputnik_dao.wasm", 10).await?;
        let policy = std::fs::read_to_string(contracts_dir().join("scripts/dao-policy.json"))?
            .replace("__DIBS__", self.dibs.id().as_str())
            .replace("__CREW__", &format!("\"{}\"", self.booker.id()));
        let policy: Value = serde_json::from_str(&policy)?;
        d.call("new")
            .args_json(json!({"config": {"name": name, "purpose": "Dibs trip pot", "metadata": ""}, "policy": policy}))
            .transact()
            .await?
            .into_result()?;
        Ok(d)
    }

    pub async fn create_trip(&self, code: &str, n: u8, n_wait: u8, book_by: u64, dao: &Contract) -> anyhow::Result<ExecutionFinalResult> {
        let cost: String = self.dibs.view("create_cost").args_json(json!({"n_beds": n, "n_wait": n_wait})).await?.json()?;
        let dep = NearToken::from_yoctonear(cost.parse::<u128>()? + 1_000_000_000_000_000_000_000);
        Ok(self
            .relayer
            .call(self.dibs.id(), "create_trip")
            .args_json(json!({
                "code": code, "price": PRICE.to_string(), "n_beds": n, "n_wait": n_wait, "book_by": book_by.to_string(),
                "booker": self.booker.id(), "dao": dao.id(), "check_in": "2026-12-04", "check_out": "2026-12-07", "stay": "Casa do Largo, Lisbon"
            }))
            .deposit(dep)
            .gas(Gas::from_tgas(300))
            .transact()
            .await?)
    }

    pub fn slot(&self, kind: char, n: u8, trip: &str) -> AccountId {
        format!("{kind}{n:02}-{trip}.{}", self.dibs.id()).parse().unwrap()
    }

    pub async fn hold(&self, trip: &str, n: u8, holder: &Account) -> anyhow::Result<ExecutionFinalResult> {
        Ok(holder.call(self.dibs.id(), "hold").args_json(json!({"trip": trip, "n": n, "holder": holder.id()})).gas(Gas::from_tgas(60)).transact().await?)
    }

    pub async fn mint(&self, to: &AccountId, amount: u128) -> anyhow::Result<()> {
        self.top.call(self.usdc.id(), "mint").args_json(json!({"account_id": to, "amount": amount.to_string()})).transact().await?.into_result()?;
        Ok(())
    }

    pub async fn sweep_amount(&self, kind: char, n: u8, trip: &str, amount: u128) -> anyhow::Result<ExecutionFinalResult> {
        let id = self.slot(kind, n, trip);
        Ok(self.relayer.call(&id, "sweep").args_json(json!({"amount": amount.to_string()})).gas(Gas::from_tgas(300)).transact().await?)
    }

    /// Mint `PRICE` into the bed account and sweep it.
    pub async fn pay_bed(&self, trip: &str, n: u8) -> anyhow::Result<ExecutionFinalResult> {
        self.mint(&self.slot('b', n, trip), PRICE).await?;
        self.sweep_amount('b', n, trip, PRICE).await
    }

    pub async fn pay_wait(&self, trip: &str, n: u8) -> anyhow::Result<ExecutionFinalResult> {
        self.mint(&self.slot('w', n, trip), PRICE).await?;
        self.sweep_amount('w', n, trip, PRICE).await
    }

    pub async fn bal(&self, who: &AccountId) -> u128 {
        let b: String = self.usdc.view("ft_balance_of").args_json(json!({"account_id": who})).await.unwrap().json().unwrap();
        b.parse().unwrap()
    }

    pub async fn trip(&self, code: &str) -> Value {
        self.dibs.view("get_trip").args_json(json!({"trip": code})).await.unwrap().json().unwrap()
    }

    pub async fn stage(&self, message: &str, signature: &str) {
        let r = json!({"message": message, "signature": signature}).to_string();
        self.top.call(self.outlayer.id(), "set_response").args_json(json!({"response": r})).transact().await.unwrap().into_result().unwrap();
    }

    pub async fn stage_none(&self) {
        self.top.call(self.outlayer.id(), "set_response").args_json(json!({"response": ""})).transact().await.unwrap().into_result().unwrap();
    }

    pub async fn submit_proof(&self, trip: &str) -> anyhow::Result<ExecutionFinalResult> {
        Ok(self
            .booker
            .call(self.dibs.id(), "submit_proof")
            .args_json(json!({"trip": trip, "blob_url": "https://dibs-blobs.example/b/abc123", "blob_sha256": "ef".repeat(32)}))
            .deposit(NearToken::from_millinear(20))
            .gas(Gas::from_tgas(300))
            .transact()
            .await?)
    }

    pub async fn request_draw(&self, trip: &str) -> anyhow::Result<ExecutionFinalResult> {
        Ok(self.relayer.call(self.dibs.id(), "request_draw").args_json(json!({"trip": trip})).deposit(NearToken::from_millinear(20)).gas(Gas::from_tgas(300)).transact().await?)
    }

    pub async fn refund_all(&self, trip: &str, limit: u8) -> anyhow::Result<ExecutionFinalResult> {
        Ok(self.relayer.call(self.dibs.id(), "refund_all").args_json(json!({"trip": trip, "limit": limit})).gas(Gas::from_tgas(300)).transact().await?)
    }

    /// Create a trip and its DAO; no beds held yet.
    pub async fn new_trip(&self, code: &str, n: u8, n_wait: u8, book_by: u64) -> anyhow::Result<Contract> {
        let dao = self.dao(&format!("{code}dao")).await?;
        let r = self.create_trip(code, n, n_wait, book_by, &dao).await?;
        anyhow::ensure!(r.is_success(), "create_trip failed: {}", text(&r));
        Ok(dao)
    }

    /// Fresh users hold beds 1..=k, optionally paying.
    pub async fn holders(&self, code: &str, k: u8, pay: bool) -> anyhow::Result<Vec<Account>> {
        let mut users = vec![];
        for i in 1..=k {
            let u = Self::user(&self.top, &format!("{code}u{i}")).await?;
            let h = self.hold(code, i, &u).await?;
            anyhow::ensure!(h.is_success(), "hold failed: {}", text(&h));
            if pay {
                let p = self.pay_bed(code, i).await?;
                anyhow::ensure!(p.is_success(), "pay failed: {}", text(&p));
            }
            users.push(u);
        }
        Ok(users)
    }

    /// Create a trip with `n` beds, all held by fresh users (returned), optionally all paid.
    pub async fn trip_with_holders(&self, code: &str, n: u8, n_wait: u8, book_by: u64, pay: bool) -> anyhow::Result<(Contract, Vec<Account>)> {
        let dao = self.new_trip(code, n, n_wait, book_by).await?;
        Ok((dao, self.holders(code, n, pay).await?))
    }
}
