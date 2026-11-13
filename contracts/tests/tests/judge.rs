//! Every attack from the brief, one sandbox world. Writes contracts/judge-report.json.
use dibs_tests::report::Report;
use dibs_tests::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[tokio::test]
async fn judge_attacks() -> anyhow::Result<()> {
    let w = World::new().await?;
    let mut rep = Report::default();
    let now = w.now_ns().await;

    // trip D expires soon; fund it first so the clock runs while other checks execute
    let (_dd, du) = w.trip_with_holders("dead0001", 3, 1, now + 100_000_000_000, true).await?;

    // ---- trip A: main attack surface ----
    let a = "attk0001";
    let dao = w.new_trip(a, 4, 2, now + 2 * DAY_NS).await?;
    let mut users = w.holders(a, 3, false).await?; // beds 1-3 held, bed 4 stays Open
    let stranger = World::user(&w.top, "stranger").await?;
    let dibs = w.dibs.id();

    let r = users[0].call(dibs, "request_refund").args_json(json!({"trip": a, "n": 1})).transact().await?;
    rep.check("request_refund always refused", "E_NO_REFUND", &text(&r), r.is_failure());

    let r = stranger.call(dibs, "list_for_resale").args_json(json!({"trip": a, "n": 1})).transact().await?;
    rep.check("non-holder lists a bed", "E_NOT_HOLDER", &text(&r), r.is_failure());

    let r = stranger.call(dibs, "hold").args_json(json!({"trip": a, "n": 4, "holder": users[1].id()})).transact().await?;
    rep.check("stranger holds a bed for someone else", "E_NOT_RELAYER", &text(&r), r.is_failure());

    let r = w.pay_bed(a, 4).await?; // bed 4 is Open (nobody holds it)
    let bed4 = w.bal(&w.slot('b', 4, a)).await;
    rep.check("pay a bed nobody holds", "E_NOT_HELD", &text(&r), bed4 == PRICE);

    w.mint(&w.slot('b', 1, a), 1).await?; // bed 1 holds PRICE-? mint 1 extra so balance is PRICE+1
    w.mint(&w.slot('b', 1, a), PRICE - 2).await?;
    let r = w.sweep_amount('b', 1, a, PRICE - 1).await?;
    let t = w.trip(a).await;
    rep.check("pay wrong amount (price - 1)", "E_WRONG_AMOUNT", &text(&r), t["beds"][0]["status"] == "Held" && w.bal(&w.slot('b', 1, a)).await == PRICE - 1);
    let r = w.sweep_amount('b', 1, a, PRICE + 1).await?;
    rep.check("pay wrong amount (balance too small)", "", &text(&r), w.bal(dao.id()).await == 0);

    // fake bed account: not b01-attk0001.<dibs>
    w.mint(stranger.id(), PRICE).await?;
    w.top.call(w.usdc.id(), "storage_deposit").args_json(json!({"account_id": stranger.id()})).deposit(NearToken::from_millinear(10)).transact().await?.into_result()?;
    let r = stranger
        .call(w.usdc.id(), "ft_transfer_call")
        .args_json(json!({"receiver_id": dibs, "amount": PRICE.to_string(), "msg": json!({"kind":"bed","trip":a,"n":1}).to_string()}))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;
    let t = w.trip(a).await;
    rep.check("sweep from a fake (non-bed) account", "E_BAD_SENDER", &text(&r), t["beds"][0]["status"] == "Held" && w.bal(stranger.id()).await == PRICE);

    let r = stranger.call(dibs, "ft_on_transfer").args_json(json!({"sender_id": "b01-attk0001.dibs.test.near", "amount": PRICE.to_string(), "msg": json!({"kind":"bed","trip":a,"n":1}).to_string()})).transact().await?;
    rep.check("ft_on_transfer from non-USDC caller", "E_NOT_USDC", &text(&r), r.is_failure());

    for m in ["on_proof", "on_draw", "on_forward"] {
        let r = w.booker.call(dibs, m).args_json(json!({"trip": a, "caller": w.booker.id(), "deposit": "1", "n": 1})).transact().await?;
        rep.check(&format!("booker calls private callback {m}"), "E_PRIVATE", &text(&r), r.is_failure());
    }

    let kind = json!({"Transfer": {"token_id": w.usdc.id(), "receiver_id": w.booker.id(), "amount": "1", "msg": null}});
    let r = w.booker.call(dao.id(), "add_proposal").args_json(json!({"proposal": {"description": "grab", "kind": kind}})).transact().await?;
    rep.check("booker adds a DAO transfer directly", "ERR_PERMISSION_DENIED", &text(&r), r.is_failure());

    let r = w.booker.call(dibs, "set_verifier_key").args_json(json!({"key_hex": "00".repeat(32)})).transact().await?;
    rep.check("non-owner replaces verifier key", "E_NOT_OWNER", &text(&r), r.is_failure());

    let r = w.submit_proof(a).await?;
    rep.check("submit proof before all beds paid", "E_NOT_FULL", &text(&r), r.is_failure());
    let r = w.request_draw(a).await?;
    rep.check("draw before full", "E_NOT_FULL", &text(&r), r.is_failure());
    let r = w.create_trip(a, 4, 2, now + DAY_NS, &dao).await?;
    rep.check("create a trip twice", "E_TRIP_EXISTS", &text(&r), r.is_failure());
    let r = w.relayer.call(dibs, "create_trip").args_json(json!({"code":"cheap001","price":"250000","n_beds":4,"book_by":(now + DAY_NS).to_string(),"booker":w.booker.id(),"dao":dao.id(),"check_in":"2026-12-04","check_out":"2026-12-07"})).deposit(NearToken::from_millinear(1)).gas(Gas::from_tgas(300)).transact().await?;
    rep.check("create a trip without the deposit", "E_DEPOSIT", &text(&r), r.is_failure());

    // fund everything: bed 1 holds PRICE-1 already (top up 1), beds 2 and 3 are held, bed 4 gets a holder now
    w.mint(&w.slot('b', 1, a), 1).await?;
    w.sweep_amount('b', 1, a, PRICE).await?.into_result()?;
    users.push(World::user(&w.top, "attk0001u4").await?);
    w.hold(a, 4, &users[3]).await?.into_result()?;
    w.sweep_amount('b', 4, a, PRICE).await?.into_result()?; // bed 4 account kept its earlier PRICE
    w.pay_bed(a, 2).await?.into_result()?;
    w.pay_bed(a, 3).await?.into_result()?;
    w.mint(&w.slot('b', 1, a), PRICE).await?;
    let r = w.sweep_amount('b', 1, a, PRICE).await?;
    rep.check("pay an already-paid bed again", "E_ALREADY_PAID", &text(&r), w.trip(a).await["beds"][0]["status"] == "Paid");
    let t = w.trip(a).await;
    let paid = t["beds"].as_array().unwrap().iter().all(|b| b["status"] == "Paid");
    rep.check("all four beds paid, pot sits in the DAO", "", "", paid && w.bal(dao.id()).await == PRICE * 4);

    // ---- draw ----
    let out = "22".repeat(32);
    let m = vrf_message(a, &out);
    w.stage(&m, &sign(&key(9), &m)).await; // forged: wrong key
    w.request_draw(a).await?;
    rep.check("forged draw signature", "E_BAD_SIG", &w.trip(a).await["last_error"].to_string(), w.trip(a).await["drawn_out"] == false);
    w.stage_none().await;
    w.request_draw(a).await?;
    rep.check("OutLayer returns nothing for the draw", "E_NO_RESULT", &w.trip(a).await["last_error"].to_string(), w.trip(a).await["drawn_out"] == false);
    w.stage(&m, &sign(&w.verifier, &m)).await;
    w.request_draw(a).await?;
    rep.check("genuine draw succeeds", "", "", w.trip(a).await["drawn_out"] == true);
    let r = w.request_draw(a).await?;
    rep.check("double draw", "E_DRAWN", &text(&r), r.is_failure());

    // ---- proof attacks: each must leave the pot untouched ----
    let pot = PRICE * 4;
    let good = || Facts::ok(a, 4, 900_000);
    let cases: Vec<(&str, &str, Facts)> = vec![
        ("proof with wrong dates", "E_DATES", Facts { check_out: "2026-12-08".into(), ..good() }),
        ("proof with wrong guests", "E_GUESTS", Facts { guests: 3, ..good() }),
        ("proof with total above the pot", "E_TOTAL", Facts { total: pot + 1, ..good() }),
        ("proof from a domain that is not allowed", "E_DOMAIN", Facts { domain: "evil-mail.example".into(), ..good() }),
        ("proof for another trip", "E_TRIP_MISMATCH", Facts { trip: "other001".into(), ..good() }),
    ];
    for (name, code, f) in cases {
        w.stage(&f.message(), &sign(&w.verifier, &f.message())).await;
        w.submit_proof(a).await?;
        rep.check(name, code, &w.trip(a).await["last_error"].to_string(), w.bal(dao.id()).await == pot && w.trip(a).await["proof"].is_null());
    }
    let f = good();
    let view_ok: String = w.dibs.view("check_proof").args_json(json!({"trip": a, "message": f.message(), "signature": sign(&w.verifier, &f.message())})).await?.json()?;
    rep.check("check_proof view accepts a genuine message", "OK", &view_ok, true);
    let view_bad: String = w.dibs.view("check_proof").args_json(json!({"trip": a, "message": f.message(), "signature": sign(&key(9), &f.message())})).await?.json()?;
    rep.check("check_proof view rejects a forged message", "E_BAD_SIG", &view_bad, true);
    w.stage(&f.message(), &sign(&key(9), &f.message())).await;
    w.submit_proof(a).await?;
    rep.check("forged OutLayer booking signature", "E_BAD_SIG", &w.trip(a).await["last_error"].to_string(), w.bal(dao.id()).await == pot);
    w.stage(&f.message().replace("dibs-booking:v1:", "dibs-booking:v2:"), &sign(&w.verifier, &f.message())).await;
    w.submit_proof(a).await?;
    rep.check("wrong message prefix", "E_BAD_PREFIX", &w.trip(a).await["last_error"].to_string(), w.bal(dao.id()).await == pot);
    let r = stranger.call(dibs, "submit_proof").args_json(json!({"trip": a, "blob_url": "https://x.example/b", "blob_sha256": "ef".repeat(32)})).deposit(NearToken::from_millinear(20)).gas(Gas::from_tgas(300)).transact().await?;
    rep.check("non-booker submits proof", "E_NOT_BOOKER", &text(&r), r.is_failure());
    let r = w.refund_all(a, 2).await?;
    rep.check("refund_all before the deadline", "E_BEFORE_DEADLINE", &text(&r), r.is_failure());

    w.stage(&f.message(), &sign(&w.verifier, &f.message())).await;
    let before = w.bal(w.booker.id()).await;
    w.submit_proof(a).await?;
    let t = w.trip(a).await;
    rep.check("valid proof pays the booker through the DAO", "", "", t["payout"] == "Done" && w.bal(w.booker.id()).await - before == 900_000);
    let r = w.submit_proof(a).await?;
    rep.check("second proof for the same trip", "E_PROOF_EXISTS", &text(&r), r.is_failure());

    // same booking email reused on another trip
    let (_d2, _u2) = w.trip_with_holders("repl0001", 2, 1, now + DAY_NS, true).await?;
    let f2 = Facts::ok("repl0001", 2, 300_000);
    w.stage(&f2.message(), &sign(&w.verifier, &f2.message())).await;
    w.submit_proof("repl0001").await?;
    rep.check("same booking reference replayed on another trip", "E_REPLAY", &w.trip("repl0001").await["last_error"].to_string(), w.trip("repl0001").await["proof"].is_null());

    // ---- resale ----
    let (rdao, ru) = w.trip_with_holders("resl0001", 3, 2, now + DAY_NS, true).await?;
    let (rt, buyer) = ("resl0001", World::user(&w.top, "buyer").await?);
    let seller_before = w.bal(ru[0].id()).await;
    let r = ru[0].call(dibs, "list_for_resale").args_json(json!({"trip": rt, "n": 1, "price": "999999"})).transact().await?;
    r.into_result()?;
    w.hold(rt, 1, &buyer).await?.into_result()?;
    w.mint(&w.slot('b', 1, rt), 1).await?;
    w.mint(&w.slot('b', 1, rt), PRICE).await?;
    let r = w.sweep_amount('b', 1, rt, PRICE + 1).await?;
    rep.check("resale above face value is refused", "E_WRONG_AMOUNT", &text(&r), w.trip(rt).await["beds"][0]["status"] == "Listed");
    w.sweep_amount('b', 1, rt, PRICE).await?.into_result()?;
    let t = w.trip(rt).await;
    rep.check("resale at face: seller gets exactly price, buyer holds", "", "", w.bal(ru[0].id()).await - seller_before == PRICE && t["beds"][0]["holder"] == json!(buyer.id()) && t["beds"][0]["status"] == "Paid" && w.bal(rdao.id()).await == PRICE * 3);
    let w1 = World::user(&w.top, "waiter1").await?;
    w1.call(dibs, "reserve_wait").args_json(json!({"trip": rt, "slot": 1, "buyer": w1.id()})).gas(Gas::from_tgas(60)).transact().await?.into_result()?;
    w.pay_wait(rt, 1).await?.into_result()?;
    let held = w.bal(dibs).await;
    let s2 = w.bal(ru[1].id()).await;
    ru[1].call(dibs, "list_for_resale").args_json(json!({"trip": rt, "n": 2})).gas(Gas::from_tgas(300)).transact().await?.into_result()?;
    let t = w.trip(rt).await;
    rep.check("waitlist head fills a listed bed at once", "", "", held == PRICE && w.bal(ru[1].id()).await - s2 == PRICE && t["beds"][1]["holder"] == json!(w1.id()) && t["waitlist"].as_array().unwrap().is_empty());
    let w2 = World::user(&w.top, "waiter2").await?;
    w2.call(dibs, "reserve_wait").args_json(json!({"trip": rt, "slot": 2, "buyer": w2.id()})).gas(Gas::from_tgas(60)).transact().await?.into_result()?;
    w.pay_wait(rt, 2).await?.into_result()?;
    w2.call(dibs, "leave_waitlist").args_json(json!({"trip": rt})).gas(Gas::from_tgas(100)).transact().await?.into_result()?;
    rep.check("leave_waitlist returns the buyer's funds", "", "", w.bal(w2.id()).await == PRICE && w.trip(rt).await["waitlist"].as_array().unwrap().is_empty());

    // ---- refund path (trip D) ----
    while w.now_ns().await <= now + 100_000_000_000 {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }
    let r = w.submit_proof("dead0001").await?;
    rep.check("proof after the deadline", "E_DEADLINE", &text(&r), r.is_failure());
    let dao_d = "dead0001dao.test.near".parse()?;
    let r1 = w.refund_all("dead0001", 2).await?;
    let t = w.trip("dead0001").await;
    rep.check("refund_all pays the first batch back", "", &text(&r1), r1.is_success() && t["refunded"] == false);
    w.refund_all("dead0001", 2).await?;
    let t = w.trip("dead0001").await;
    let mut all_back = true;
    for u in &du {
        all_back &= w.bal(u.id()).await == PRICE;
    }
    rep.check("every holder got full price back after the deadline", "", &t["last_error"].to_string(), all_back && t["refunded"] == true && w.bal(&dao_d).await == 0);
    let r = w.refund_all("dead0001", 2).await?;
    rep.check("double refund_all", "E_REFUNDED", &text(&r), r.is_failure());

    let sz = |f: &str| wasm(f).len();
    rep.check("bed wasm is at most 8 KB", "", "", sz("bed.wasm") <= 8 * 1024);
    let d = sz("dibs.wasm");
    rep.note(
        "dibs wasm <= 110 KB after wasm-opt -Oz",
        if d <= 110 * 1024 { "met" } else { "NOT MET" },
        &format!("{d} bytes; see HANDBACK.md for the cost and the options"),
    );
    rep.note("create_trip does not check that the DAO policy gives only dibs the transfer role", "unenforced", "coordinator seeds DAOs with scripts/dao-policy.json; on-chain policy read-back not implemented");
    rep.note("OutLayer real worker signature and VRF", "unverified", "sandbox uses mock-outlayer with a local ed25519 key; the real key is pinned later with set_verifier_key");
    rep.write(&contracts_dir().join("judge-report.json"));
    Ok(())
}
