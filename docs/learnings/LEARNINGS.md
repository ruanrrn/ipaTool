# Learnings

## [LRN-20260423-001] Pre-push CI check simulation is mandatory for Rust projects

**Logged**: 2026-04-23T16:15:00Z
**Priority**: critical
**Status**: pending
**Area**: infra

### Summary
Always run `cargo clippy -- -D warnings && cargo fmt --all --check` locally before pushing. CI uses these as hard gates; fixing after push wastes 3+ round trips per PR.

### Details
ipaTool CI has two hard gates in the "Test" job:
1. `cargo clippy -- -D warnings` — treats all warnings as errors
2. `cargo fmt --all -- --check` — rejects any formatting drift

The local `cargo build --release` does NOT catch either. In this PR, 5 clippy warnings + extensive formatting drift accumulated because subagents only verified compilation.

### Suggested Action
1. Add to subagent instructions: "After all code changes, run `cd server && cargo clippy -- -D warnings && cargo fmt --all --check` and fix any failures before declaring done."
2. Consider adding a `Makefile` or `justfile` target: `make lint` that runs both checks.
3. Consider a git pre-push hook.

### Metadata
- Source: error
- Related Files: server/src/main.rs, server/src/ipa_handler.rs, .github/workflows/
- Tags: rust, ci, clippy, rustfmt, pre-push, subagent
- See Also: ERR-20260423-001
- Pattern-Key: simplify.pre_push_ci_check
- Recurrence-Count: 1
- First-Seen: 2026-04-23
- Last-Seen: 2026-04-23

---

## [LRN-20260423-002] `cargo fmt --all` vs `cargo fmt` — scope matters

**Logged**: 2026-04-23T16:15:00Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
`cargo fmt` without `--all` may only format files in the current crate. Use `cargo fmt --all` to cover all workspace members.

### Details
After fixing main.rs formatting, CI still failed because `ipa_handler.rs` (a separate file in the same crate) also had formatting drift. Running `cargo fmt` only formatted main.rs. `cargo fmt --all` caught ipa_handler.rs too.

### Suggested Action
Always use `cargo fmt --all` (or `cargo fmt --all -- --check` for CI). Never bare `cargo fmt`.

### Metadata
- Source: error
- Related Files: server/src/ipa_handler.rs
- Tags: rust, rustfmt, workspace
- See Also: ERR-20260423-001

---

## [LRN-20260423-003] Subagent code generation must include lint step

**Logged**: 2026-04-23T16:15:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
When delegating Rust code changes to subagents, the completion criteria must explicitly include running clippy and rustfmt — not just `cargo build`.

### Details
In PR #17, multiple subagents generated Rust code and verified with `cargo build --release`. None ran clippy or fmt. This resulted in 5 clippy warnings and extensive formatting drift that required 3 fix commits.

### Suggested Action
When writing subagent prompts for Rust code changes, append:
```
After making code changes, you MUST run:
  cargo clippy -- -D warnings
  cargo fmt --all --check
Fix any errors before returning.
```

### Metadata
- Source: error
- Related Files: (any Rust project using delegate_task)
- Tags: rust, subagent, clippy, rustfmt, quality-gate
- See Also: ERR-20260423-001, LRN-20260423-001
- Pattern-Key: simplify.subagent_rust_lint
- Recurrence-Count: 1
- First-Seen: 2026-04-23
- Last-Seen: 2026-04-23

---
