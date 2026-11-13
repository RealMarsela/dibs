use std::path::PathBuf;
fn main() {
    println!("cargo:rerun-if-env-changed=DIBS_BED_WASM");
    let default = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("../build/bed.wasm");
    let p = std::env::var("DIBS_BED_WASM").map(PathBuf::from).unwrap_or(default);
    println!("cargo:rerun-if-changed={}", p.display());
    println!("cargo:rustc-env=DIBS_BED_PATH={}", p.display());
}
