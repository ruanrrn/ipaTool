# Error Log

## [ERR-20260423-001] PR CI check failures: clippy + rustfmt (3 rounds)

**Logged**: 2026-04-23T16:15:00Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
PR #17 (feat/community-archive-v1) failed CI checks 3 times in a row, requiring 3 separate fix-and-push rounds.

### Error
**Round 1**: 5 clippy warnings (match→if-let, case-insensitive comparison, too_many_arguments, unnecessary closures)
**Round 2**: rustfmt formatting diffs in `main.rs` (102 insertions, 58 deletions)
**Round 3**: rustfmt formatting diffs in `ipa_handler.rs` (10 insertions, 3 deletions)

### Context
- CI runs `cargo clippy -- -D warnings` AND `cargo fmt --check` on GitHub Actions
- Local development only ran `cargo build --release` (not clippy, not fmt)
- New code was written by subagents that didn't run pre-push lint/format checks
- `cargo fmt --all` was needed (not just `cargo fmt` on main.rs) because `ipa_handler.rs` also had drift

### Root Cause
1. **No pre-push CI simulation**: Code was pushed without running the same checks CI runs
2. **Subagent blind spot**: Subagents were told to build and verify, but not to run clippy/fmt
3. **Partial fix scope**: First fmt fix only covered main.rs, missed ipa_handler.rs

### Resolution
- **Resolved**: 2026-04-23T16:10:00Z
- **Commits**: 403807f (clippy), 134c394 (fmt main.rs), 8cdd16e (fmt ipa_handler.rs)
- **PR**: https://github.com/ruanrrn/ipaTool/pull/17

### Suggested Fix (preventive)
Before pushing any branch, always run:
```bash
cd server && cargo clippy -- -D warnings && cargo fmt --all --check
```

Better: add a pre-push git hook or make it part of the subagent instructions.

### Metadata
- Reproducible: yes
- Related Files: server/src/main.rs, server/src/ipa_handler.rs
- See Also: LRN-20260423-001

---
