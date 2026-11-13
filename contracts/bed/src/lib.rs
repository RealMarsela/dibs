//! Dibs bed receipt account: raw no_std wasm. One method, `sweep(amount)`, no state, no keys.
//! Parses its own account id `b|wNN-<trip>.<dibs>` and calls
//! `<usdc>.ft_transfer_call(<dibs>, amount, {"kind":"bed|wait","trip":"<trip>","n":NN})` with 1 yocto.
#![no_std]

const USDC: &str = env!("DIBS_USDC_BAKED");

extern "C" {
    fn read_register(id: u64, ptr: u64);
    fn register_len(id: u64) -> u64;
    fn input(register_id: u64);
    fn current_account_id(register_id: u64);
    fn panic_utf8(len: u64, ptr: u64) -> !;
    fn prepaid_gas() -> u64;
    fn used_gas() -> u64;
    fn promise_batch_create(len: u64, ptr: u64) -> u64;
    fn promise_batch_action_function_call(
        idx: u64, mlen: u64, mptr: u64, alen: u64, aptr: u64, amount_ptr: u64, gas: u64,
    );
}

#[panic_handler]
fn on_panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

fn fail(msg: &str) -> ! {
    unsafe { panic_utf8(msg.len() as u64, msg.as_ptr() as u64) }
}

const BUF: usize = 1024;
static mut IN: [u8; BUF] = [0; BUF];
static mut ME: [u8; 128] = [0; 128];
static mut OUT: [u8; BUF] = [0; BUF];

struct W {
    n: usize,
}

impl W {
    fn put(&mut self, s: &[u8]) {
        unsafe {
            let out = &mut *core::ptr::addr_of_mut!(OUT);
            if self.n + s.len() > BUF {
                fail("E_BAD_ARGS");
            }
            out[self.n..self.n + s.len()].copy_from_slice(s);
        }
        self.n += s.len();
    }
}

fn load(reg: u64, buf: &mut [u8]) -> usize {
    unsafe {
        let len = register_len(reg) as usize;
        if len > buf.len() {
            fail("E_BAD_ARGS");
        }
        read_register(reg, buf.as_mut_ptr() as u64);
        len
    }
}

/// Digits of the `amount` field (`"amount":"123"` or `"amount":123`) as a slice of `inp`.
fn amount_digits(inp: &[u8]) -> &[u8] {
    let key = b"\"amount\"";
    let mut i = 0;
    while i + key.len() <= inp.len() && &inp[i..i + key.len()] != key {
        i += 1;
    }
    if i + key.len() > inp.len() {
        fail("E_BAD_ARGS");
    }
    i += key.len();
    while i < inp.len() && matches!(inp[i], b' ' | b':' | b'"') {
        i += 1;
    }
    let s = i;
    while i < inp.len() && inp[i].is_ascii_digit() {
        i += 1;
    }
    if i == s || i - s > 38 {
        fail("E_BAD_ARGS");
    }
    &inp[s..i]
}

#[no_mangle]
pub extern "C" fn sweep() {
    unsafe {
        input(0);
        let inp = &mut *core::ptr::addr_of_mut!(IN);
        let il = load(0, inp);
        let amount = amount_digits(&inp[..il]);

        current_account_id(1);
        let me = &mut *core::ptr::addr_of_mut!(ME);
        let ml = load(1, me);
        let id = &me[..ml];
        // b|wNN-<trip>.<dibs>
        if ml < 8 || !(id[0] == b'b' || id[0] == b'w') || !id[1].is_ascii_digit() || !id[2].is_ascii_digit() || id[3] != b'-' {
            fail("E_BAD_BED");
        }
        let dot = match id.iter().position(|c| *c == b'.') {
            Some(d) if d > 4 && d + 1 < ml => d,
            _ => fail("E_BAD_BED"),
        };
        let kind: &[u8] = if id[0] == b'b' { b"bed" } else { b"wait" };
        let n = ((id[1] - b'0') * 10 + (id[2] - b'0')) as u32;
        let trip = &id[4..dot];
        let dibs = &id[dot + 1..];

        let mut w = W { n: 0 };
        w.put(b"{\"receiver_id\":\"");
        w.put(dibs);
        w.put(b"\",\"amount\":\"");
        w.put(amount);
        w.put(b"\",\"msg\":\"{\\\"kind\\\":\\\"");
        w.put(kind);
        w.put(b"\\\",\\\"trip\\\":\\\"");
        w.put(trip);
        w.put(b"\\\",\\\"n\\\":");
        if n >= 10 {
            w.put(&[b'0' + (n / 10) as u8]);
        }
        w.put(&[b'0' + (n % 10) as u8]);
        w.put(b"}\"}");

        let usdc = USDC.as_bytes();
        let p = promise_batch_create(usdc.len() as u64, usdc.as_ptr() as u64);
        let one: u128 = 1;
        let left = prepaid_gas().saturating_sub(used_gas()).saturating_sub(10_000_000_000_000);
        let out = &*core::ptr::addr_of!(OUT);
        let m = b"ft_transfer_call";
        promise_batch_action_function_call(
            p, m.len() as u64, m.as_ptr() as u64, w.n as u64, out.as_ptr() as u64,
            &one as *const u128 as u64, left,
        );
    }
}
