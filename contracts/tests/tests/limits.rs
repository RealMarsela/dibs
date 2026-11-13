//! Gas limits: the largest trip fits one create_trip, and a refund batch of 3 fits 300 Tgas.
use dibs_tests::*;

#[tokio::test]
async fn largest_trip_and_refund_batch_fit_300_tgas() -> anyhow::Result<()> {
    let w = World::new().await?;
    let now = w.now_ns().await;
    let dao = w.new_trip("maxi0001", 14, 4, now + DAY_NS).await?;
    let t = w.trip("maxi0001").await;
    assert_eq!(t["beds"].as_array().unwrap().len(), 14);
    for (k, n) in [('b', 14u8), ('w', 4u8)] {
        let acct = w.worker.view_account(&w.slot(k, n, "maxi0001")).await?;
        assert!(acct.storage_usage > 2000, "{k}{n} has no code");
    }
    let _ = dao;
    // 3 beds paid, then the deadline passes: one refund_all(3) must refund all three
    let (_d, users) = w.trip_with_holders("refd0001", 3, 1, now + 45_000_000_000, true).await?;
    while w.now_ns().await <= now + 45_000_000_000 {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }
    let r = w.refund_all("refd0001", 3).await?;
    println!("refund batch of 3: gas burnt {} Tgas, success {}", r.total_gas_burnt.as_tgas(), r.is_success());
    for u in &users {
        assert_eq!(w.bal(u.id()).await, PRICE);
    }
    assert_eq!(w.trip("refd0001").await["refunded"], true);
    Ok(())
}
