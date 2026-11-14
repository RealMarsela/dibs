use dibs_tests::*;

/// The inbox Worker submits through the relayer: the booking is the authority, the payout still goes to the booker.
#[tokio::test]
async fn relayer_submits_proof_booker_is_paid_stranger_refused() -> anyhow::Result<()> {
    let w = World::new().await?;
    let now = w.now_ns().await;
    let (dao, _users) = w.trip_with_holders("lis0312", 8, 2, now + DAY_NS, true).await?;
    let total = 1_800_000u128;
    let f = Facts::ok("lis0312", 8, total);
    w.stage(&f.message(), &sign(&w.verifier, &f.message())).await;

    let stranger = World::user(&w.top, "stranger").await?;
    let r = w.submit_proof_by(&stranger, "lis0312").await?;
    assert!(r.is_failure() && text(&r).contains("E_NOT_BOOKER"), "{}", text(&r));

    let before = w.bal(w.booker.id()).await;
    let relayer_before = w.bal(w.relayer.id()).await;
    let r = w.submit_proof_by(&w.relayer, "lis0312").await?;
    assert!(r.is_success(), "{}", text(&r));
    let t = w.trip("lis0312").await;
    assert_eq!(t["last_error"], "", "{t}");
    assert_eq!(t["payout"], "Done", "{t}");
    assert_eq!(w.bal(w.booker.id()).await - before, total, "booker is paid");
    assert_eq!(w.bal(w.relayer.id()).await, relayer_before, "relayer receives no USDC");
    assert_eq!(w.bal(dao.id()).await, PRICE * 8 - total);
    Ok(())
}
