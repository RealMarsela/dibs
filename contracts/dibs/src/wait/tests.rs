use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use near_sdk::NearToken;

const T0: u64 = 1_800_000_000_000_000_000;
const MIN: u64 = 60 * 1_000_000_000;
const TRIP: &str = "tst001";

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(caller: &str, now: u64) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("dibs.testnet")).predecessor_account_id(acc(caller)).signer_account_id(acc(caller)).block_timestamp(now);
    b
}

fn setup() -> Dibs {
    testing_env!(ctx("owner.testnet", T0).build());
    let mut d = Dibs::new(acc("owner.testnet"), acc("usdc.testnet"), acc("outlayer.testnet"), "p".into(), vec![], U128(0));
    let need = d.create_cost(2, 2).0;
    testing_env!(ctx("owner.testnet", T0).attached_deposit(NearToken::from_yoctonear(need)).build());
    d.create_trip(
        TRIP.into(),
        U128(5_000_000),
        2,
        Some(2),
        U64(T0 + 100_000 * MIN),
        acc("booker.testnet"),
        acc("dao.testnet"),
        "2027-01-10".into(),
        "2027-01-12".into(),
        None,
    );
    d
}

fn reserve(d: &mut Dibs, who: &str, slot: u8, now: u64) {
    testing_env!(ctx(who, now).build());
    d.reserve_wait(TRIP.into(), slot, acc(who));
}

fn holder(d: &Dibs, slot: u8) -> Option<AccountId> {
    d.trips.get(&TRIP.to_string()).unwrap().wait_res[slot as usize - 1].clone()
}

fn fund(d: &mut Dibs, who: &str, slot: u8) {
    d.trips.get_mut(&TRIP.to_string()).unwrap().waitlist.push(WaitEntry { buyer: acc(who), slot });
}

fn holds(d: &Dibs) -> Vec<Option<u64>> {
    d.get_wait_holds(TRIP.into()).into_iter().map(|h| h.map(|u| u.0)).collect()
}

#[test]
fn reserves_a_free_slot_and_records_the_time() {
    let mut d = setup();
    assert_eq!(holds(&d), vec![None, None]);
    reserve(&mut d, "alice.testnet", 1, T0 + MIN);
    assert_eq!(holder(&d, 1), Some(acc("alice.testnet")));
    assert_eq!(holds(&d), vec![Some(T0 + MIN), None]);
}

#[test]
#[should_panic(expected = "E_SLOT_TAKEN")]
fn second_buyer_refused_inside_the_window() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    reserve(&mut d, "bob.testnet", 1, T0 + WAIT_HOLD_NS / MIN * MIN - MIN);
}

#[test]
fn takeover_allowed_once_the_window_has_passed() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    reserve(&mut d, "bob.testnet", 1, T0 + WAIT_HOLD_NS);
    assert_eq!(holder(&d, 1), Some(acc("bob.testnet")));
    assert_eq!(holds(&d)[0], Some(T0 + WAIT_HOLD_NS));
    let logs = near_sdk::test_utils::get_logs();
    assert!(logs.iter().any(|l| l.contains("wait_takeover") && l.contains("alice.testnet") && l.contains("bob.testnet")), "{logs:?}");
}

#[test]
fn legacy_reservation_without_a_time_is_takeable() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    env::storage_remove(&wr_key(TRIP, 1)); // as if reserved before the upgrade
    assert_eq!(holds(&d), vec![None, None]);
    reserve(&mut d, "bob.testnet", 1, T0 + 1);
    assert_eq!(holder(&d, 1), Some(acc("bob.testnet")));
    assert_eq!(holds(&d)[0], Some(T0 + 1));
}

#[test]
#[should_panic(expected = "E_SLOT_TAKEN")]
fn funded_slot_is_never_taken_even_when_expired() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    fund(&mut d, "alice.testnet", 1);
    reserve(&mut d, "bob.testnet", 1, T0 + 1000 * MIN);
}

#[test]
fn same_buyer_rereserve_does_not_refresh_the_time() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    reserve(&mut d, "alice.testnet", 1, T0 + 30 * MIN);
    assert_eq!(holds(&d)[0], Some(T0));
    assert_eq!(holder(&d, 1), Some(acc("alice.testnet")));
}

#[test]
fn other_slot_is_independent() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    reserve(&mut d, "bob.testnet", 2, T0 + MIN);
    assert_eq!(holds(&d), vec![Some(T0), Some(T0 + MIN)]);
}

#[test]
fn release_expired_frees_the_slot_and_the_time() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    testing_env!(ctx("anyone.testnet", T0 + WAIT_HOLD_NS).build());
    d.release_expired_wait(TRIP.into(), 1);
    assert_eq!(holder(&d, 1), None);
    assert_eq!(holds(&d), vec![None, None]);
    reserve(&mut d, "bob.testnet", 1, T0 + WAIT_HOLD_NS + 1); // free again, no takeover needed
    assert_eq!(holder(&d, 1), Some(acc("bob.testnet")));
}

#[test]
fn release_expired_frees_a_legacy_reservation() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    env::storage_remove(&wr_key(TRIP, 1));
    testing_env!(ctx("anyone.testnet", T0 + 1).build());
    d.release_expired_wait(TRIP.into(), 1);
    assert_eq!(holder(&d, 1), None);
}

#[test]
#[should_panic(expected = "E_NOT_EXPIRED")]
fn release_refused_inside_the_window() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    testing_env!(ctx("anyone.testnet", T0 + WAIT_HOLD_NS - 1).build());
    d.release_expired_wait(TRIP.into(), 1);
}

#[test]
#[should_panic(expected = "E_FUNDED")]
fn release_refused_on_a_funded_slot() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    fund(&mut d, "alice.testnet", 1);
    testing_env!(ctx("anyone.testnet", T0 + 1000 * MIN).build());
    d.release_expired_wait(TRIP.into(), 1);
}

#[test]
#[should_panic(expected = "E_NO_SLOT")]
fn release_refused_for_a_slot_out_of_range() {
    let mut d = setup();
    testing_env!(ctx("anyone.testnet", T0).build());
    d.release_expired_wait(TRIP.into(), 3);
}

#[test]
#[should_panic(expected = "E_NO_SLOT")]
fn release_refused_when_nothing_is_reserved() {
    let mut d = setup();
    testing_env!(ctx("anyone.testnet", T0).build());
    d.release_expired_wait(TRIP.into(), 1);
}

#[test]
fn leave_waitlist_clears_the_stored_time() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    assert!(wr_get(TRIP, 1).is_some());
    testing_env!(ctx("alice.testnet", T0 + MIN).build());
    d.leave_waitlist(TRIP.into());
    assert_eq!(holder(&d, 1), None);
    assert_eq!(wr_get(TRIP, 1), None);
}

#[test]
fn callbacks_never_clear_a_newer_reserver() {
    let mut d = setup();
    reserve(&mut d, "alice.testnet", 1, T0);
    reserve(&mut d, "bob.testnet", 1, T0 + WAIT_HOLD_NS); // takeover
    let t = d.trips.get_mut(&TRIP.to_string()).unwrap();
    clear_wait_if(t, 1, &acc("alice.testnet"));
    assert_eq!(t.wait_res[0], Some(acc("bob.testnet")));
    assert!(wr_get(TRIP, 1).is_some());
    clear_wait_if(t, 1, &acc("bob.testnet"));
    assert_eq!(t.wait_res[0], None);
    assert_eq!(wr_get(TRIP, 1), None);
}

#[test]
#[should_panic(expected = "E_NOT_RELAYER")]
fn only_the_buyer_or_a_relayer_may_reserve() {
    let mut d = setup();
    testing_env!(ctx("mallory.testnet", T0).build());
    d.reserve_wait(TRIP.into(), 1, acc("alice.testnet"));
}
