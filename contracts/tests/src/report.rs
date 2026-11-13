use serde_json::{json, Value};

#[derive(Default)]
pub struct Report {
    checks: Vec<Value>,
    notes: Vec<Value>,
}

impl Report {
    /// Record a check: `actual` is the text where `expected_code` must appear (empty code = state check only).
    pub fn check(&mut self, name: &str, expected_code: &str, actual: &str, extra_ok: bool) -> bool {
        let ok = extra_ok && (expected_code.is_empty() || actual.contains(expected_code));
        eprintln!("check: {name} -> {ok}");
        self.checks.push(json!({"name": name, "expected_code": expected_code, "ok": ok}));
        if !ok {
            eprintln!("FAILED {name}: expected {expected_code}, got {}", &actual[..actual.len().min(800)]);
        }
        ok
    }

    /// A rule that is not met or not enforced by a test: listed in the report, never counted as ok.
    pub fn note(&mut self, rule: &str, status: &str, detail: &str) {
        self.notes.push(json!({"rule": rule, "status": status, "detail": detail}));
    }

    pub fn write(&self, path: &std::path::Path) {
        let all_ok = self.checks.iter().all(|c| c["ok"] == true);
        let body = json!({"generated_by": "contracts/tests (near-workspaces sandbox)", "all_ok": all_ok, "checks": self.checks, "unmet_or_unenforced": self.notes});
        std::fs::write(path, serde_json::to_string_pretty(&body).unwrap() + "\n").unwrap();
        assert!(all_ok, "some judge checks failed, see {path:?}");
    }
}
