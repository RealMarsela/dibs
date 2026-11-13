//! Sandbox stand-in for outlayer.near: `request_execution` returns the response a test staged with
//! `set_response`, records the last request, and refunds the unused deposit like the real one.
use near_sdk::serde_json::Value;
use near_sdk::{env, near, NearToken, Promise, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockOutlayer {
    response: String,
    last_input: String,
    calls: u32,
}

#[near]
impl MockOutlayer {
    #[init]
    pub fn new() -> Self {
        Self { response: String::new(), last_input: String::new(), calls: 0 }
    }

    pub fn set_response(&mut self, response: String) {
        self.response = response;
    }

    #[payable]
    pub fn request_execution(&mut self, source: Value, input_data: String, resource_limits: Value, response_format: String) -> Option<Value> {
        let _ = (source, resource_limits, response_format);
        self.last_input = input_data;
        self.calls += 1;
        let dep = env::attached_deposit().as_yoctonear();
        let used = 1_000_000_000_000_000_000_000u128;
        if dep > used {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(dep - used));
        }
        if self.response.is_empty() { None } else { near_sdk::serde_json::from_str(&self.response).ok() }
    }

    pub fn get_last_input(&self) -> String {
        self.last_input.clone()
    }

    pub fn get_calls(&self) -> u32 {
        self.calls
    }
}
