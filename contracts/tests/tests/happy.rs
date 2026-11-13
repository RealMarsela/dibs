use dibs_tests::*;

#[tokio::test]
async fn happy_path_fund_draw_prove_payout() -> anyhow::Result<()> {
    let w = World::new().await?;
    let now = w.now_ns().await;
    let (dao, _users) = w.trip_with_holders("lis0312", 8, 2, now + DAY_NS, true).await?;
    let t = w.trip("lis0312").await;
    for b in t["beds"].as_array().unwrap() {
        assert_eq!(b["status"], "Paid");
    }
    // every bed's USDC went to the DAO
    assert_eq!(w.bal(dao.id()).await, PRICE * 8);

    // draw
    let out = "11".repeat(32);
    w.stage(&vrf_message("lis0312", &out), &sign(&w.verifier, &vrf_message("lis0312", &out))).await;
    let r = w.request_draw("lis0312").await?;
    assert!(r.is_success(), "{}", text(&r));
    let t = w.trip("lis0312").await;
    assert_eq!(t["drawn_out"], true, "{t}");
    let mut order: Vec<u64> = t["drawn"].as_array().unwrap().iter().map(|x| x.as_u64().unwrap()).collect();
    order.sort();
    assert_eq!(order, (1..=8).collect::<Vec<u64>>());

    // proof -> payout through the DAO
    let total = 1_800_000u128;
    let f = Facts::ok("lis0312", 8, total);
    w.stage(&f.message(), &sign(&w.verifier, &f.message())).await;
    let before = w.bal(w.booker.id()).await;
    let r = w.submit_proof("lis0312").await?;
    assert!(r.is_success(), "{}", text(&r));
    let t = w.trip("lis0312").await;
    assert_eq!(t["last_error"], "", "{t}");
    assert_eq!(t["payout"], "Done", "{t}");
    assert_eq!(w.bal(w.booker.id()).await - before, total);
    assert_eq!(w.bal(dao.id()).await, PRICE * 8 - total);
    let sent: String = w.outlayer.view("get_last_input").await?.json()?;
    assert!(sent.contains("\"op\":\"booking\"") && sent.contains("\"max_total\":\"2000000\""), "{sent}");
    Ok(())
}
