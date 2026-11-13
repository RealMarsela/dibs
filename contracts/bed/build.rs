fn main() {
    println!("cargo:rerun-if-env-changed=DIBS_USDC");
    let usdc = std::env::var("DIBS_USDC")
        .unwrap_or_else(|_| "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1".to_string());
    println!("cargo:rustc-env=DIBS_USDC_BAKED={usdc}");
}
