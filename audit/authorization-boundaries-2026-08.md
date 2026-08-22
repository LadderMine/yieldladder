# Authorization Boundary Review — 2026-08

**Scope:** Every payment-moving entrypoint across `VaultRouter`, all four tier
vaults (`VaultFlex`, `VaultL3`, `VaultL6`, `VaultL12`), and `GuardianMultisig`,
post-#138's asset-scoped storage/ABI refactor. Extends `internal-2026-01.md`'s
stated follow-up ("Review of Governance execution path for re-entrancy...
under Soroban's host-function model") to the payment path specifically.

**Trigger:** Issue #144 — `GuardianMultisig::confirm_veto` contained a literal
placeholder instead of real caller attribution, and #138's refactor across
four vaults had never had a dedicated authorization pass.

**Reviewer:** This PR.

**Status:** Complete. Two findings, both fixed in this PR.

---

## Findings

### C-01 — Three of four tier vaults gated mutating functions on the wrong address

**Severity:** Critical
**Status:** Resolved (this PR)

`VaultL3`, `VaultL6`, and `VaultL12`'s `deposit`, `withdraw`, `early_exit`,
and `relock` all called `user.require_auth()` — only `VaultFlex` correctly
called `admin.require_auth()` (`admin` = the registered `VaultRouter`
address, set at `initialize` time).

Gating on `user` instead of `admin` meant any caller holding only the
user's own signature could invoke a tier vault's `deposit` **directly**,
bypassing `VaultRouter` entirely — and with it, the pause flag, the asset
allowlist, and, most severely, the actual token transfer. `VaultRouter`'s
`deposit` moves tokens from `user` to the vault *before* invoking the
vault's own `deposit`, which only does bookkeeping (see each vault's own
doc comment: "VaultRouter has already moved the tokens... this is
bookkeeping only"). A direct call to `VaultL3::deposit` skips that
transfer while still crediting the caller with balance and shares —
shares minted for free, no principal ever deposited.

The `withdraw`/`early_exit`/`relock` versions of this bug are less severe
(no transfer skipped in the caller's favor — `VaultRouter` pays out
*after* invoking the vault) but still let a caller bypass the pause flag
and, since the vault's own internal accounting would be decremented
without the router-mediated payout ever happening, corrupt a user's
position for no benefit to the caller.

**Fix:** All four functions in all three vaults now call
`admin.require_auth()`, reading `admin` fresh from `DataKey::Admin` —
matching `VaultFlex`'s already-correct pattern exactly. Regression tests
in each vault (`test_*_direct_call_without_router_auth_is_rejected`) mock
auth for `user` only, never `admin`, and prove the call panics; a
companion `test_deposit_succeeds_with_admin_auth_only` proves the
router-mediated path still works. Every one of the rejection tests would
have passed silently against the pre-fix code — the whole point is that
they don't, now.

### C-02 — `GuardianMultisig::confirm_veto` never attributed confirmations to a real caller

**Severity:** Critical
**Status:** Resolved (this PR)

`confirm_veto` set `caller = env.current_contract_address()` (the
multisig's own address, not any invoker — Soroban has no implicit
`msg.sender`), never called `require_auth()` on anything meaningful, and
its "confirmed" tracking pushed a clone of `governance_contract` into the
confirmations list instead of the actual owner — meaning the very first
confirmation ever recorded for a proposal made every subsequent
confirmation attempt (from any owner) immediately panic with "already
confirmed" (`existing == governance_contract` is trivially true after the
first push). With any `threshold > 1`, a veto proposal could never
actually reach threshold. The only reason this passed CI before is that
the sole test exercising `confirm_veto` used `threshold = 1`.

**Fix:** `confirm_veto` now takes an explicit `owner: Address` parameter,
calls `owner.require_auth()`, verifies `owner` is in the registered owner
set, and dedupes/tracks confirmations by the real `owner` address. This
is the standard Soroban pattern for "any one of N addresses may call, but
must prove which one" — Soroban's auth model has no implicit invoker for
a direct external call, so the caller must name and authorize the address
they're acting as (the same shape the TypeScript SDK's `Signer` /
`WalletAdapter` interfaces already use for wallet signing — see
`app/src/lib/wallet/types.ts`).

Six new tests cover: a non-owner is rejected; the same owner cannot
double-count toward the threshold; `veto` dispatches to `Governance`
exactly once, exactly at threshold, and a confirmation arriving after
execution starts a fresh round rather than re-triggering it; confirmation
require_auth is genuinely enforced (one test runs with *no* auth mocking
at all and expects a panic — against the pre-fix placeholder this would
not have panicked); and confirmations are correctly scoped per
`(governance_contract, proposal_id)` pair.

**Known limitation, not fixed here (out of scope):** there is no
owner-add/remove/rotate function anywhere in `GuardianMultisig` today —
owners are fixed at `initialize`. The "owner rotated mid-proposal" edge
case from the issue therefore can't be exercised against real behavior
yet. The fix as written is already robust to it in spirit: the owner-set
membership check re-reads `DataKey::Owners` from storage on every call
rather than caching, so if a rotation function is added later, a
since-removed owner can never *add* a new confirmation. What it does
**not** do is retroactively invalidate an already-recorded confirmation
from an owner later removed — a rotation function, if added, should
explicitly decide whether to purge in-flight confirmations naming removed
owners, and that decision is deferred to whoever implements rotation.

---

## Authorization boundary reference

Every payment-moving entrypoint, who can call it, and what the
`require_auth()` at each hop actually proves. This is the "who can call
what" reference the codebase didn't have before this PR.

| Entrypoint | Caller-facing (VaultRouter) | Vault-internal (post-fix) | What each `require_auth()` proves |
|---|---|---|---|
| `deposit` | `VaultRouter.deposit(user, tier, asset, amount)` — `user.require_auth()` | `VaultX.deposit(user, asset, amount)` — `admin.require_auth()` | User authorized *this* deposit to VaultRouter; VaultRouter (the only holder of `admin`'s implicit contract-address authorization) is the only caller the vault will accept — a direct call from anyone else, even with the user's own signature, is rejected. |
| `withdraw` | `VaultRouter.withdraw(user, tier, asset, amount)` — `user.require_auth()` | `VaultX.withdraw(user, asset, amount)` — `admin.require_auth()` | Same shape as deposit. State (balance/shares) is decremented inside the vault *before* VaultRouter transfers the payout token — correct effects-before-interaction ordering (see re-entrancy review below). |
| `early_exit` | `VaultRouter.early_exit(user, tier, asset, amount)` — `user.require_auth()` | `VaultX.early_exit(user, asset, amount)` — `admin.require_auth()` | Same as withdraw, plus the exit-fee calculation, which only the vault (not the router) computes. |
| `relock` | `VaultRouter.relock(user, tier, asset)` — `user.require_auth()` | `VaultX.relock(user, asset)` — `admin.require_auth()` | Same shape; no funds move, but a direct-call bypass could still corrupt `LockUntil` bookkeeping without the router's tier-applicability check (`relock` is rejected for Flex at the router level). |
| `set_max_tvl` | `VaultRouter.set_max_tvl(tier, new_cap)` — `governance.require_auth()` | `VaultX.set_max_tvl(new_cap)` — `governance.require_auth()` | Governance's address is checked at *both* hops independently — the vault does not trust VaultRouter here the way it trusts `admin` for user-initiated calls, because VaultRouter forwards `new_cap` without itself re-authorizing as `admin`. This is intentional: Governance is meant to be able to call a vault's `set_max_tvl` through or around the router equally, since both hops require the same Governance signature. |
| `pause` / `unpause` | `VaultRouter.pause()` / `unpause()` — `guardian.require_auth()` | *(vault-level, not forwarded)* | Only the registered Guardian address can halt/resume the protocol. Confirmed unchanged after #138 — still reads `DataKey::Guardian` set at `initialize` and gates on it alone, no incidental widening. |
| `harvest` | *(HarvesterContract, out of this PR's touched files)* | — | Not modified by #138 or this PR; not re-audited here — flagged as a gap, see Recommendations. |
| `confirm_veto` | `GuardianMultisig.confirm_veto(owner, governance_contract, proposal_id)` — `owner.require_auth()` | — | `owner` must be a registered multisig owner (checked against `DataKey::Owners`) **and** must have signed for this exact call. Fixed in this PR — see C-02. |

**Reading the table's core invariant:** for every user-initiated
mutating call, the *vault* only ever trusts `VaultRouter`'s own contract
address (`admin.require_auth()`), never the end user directly. The *user*
only ever authorizes at the `VaultRouter` layer. This is what makes
`VaultRouter`'s pause flag and asset allowlist actually load-bearing —
before this PR's fix, three of four vaults let a caller route around both.

---

## Re-entrancy review of the two-hop transfer pattern

Scope: `user -> vault` on deposit, `vault -> user` on withdraw/early_exit,
under Soroban's host-function execution model (extending
`internal-2026-01.md`'s stated Governance-focused follow-up to the
payment path).

**Ordering as implemented (`VaultRouter`):**

- `deposit`: `token.transfer(user, vault, amount)` **then**
  `invoke_contract(vault, "deposit", ...)` (state update).
- `withdraw` / `early_exit`: `invoke_contract(vault, "withdraw"/"early_exit", ...)`
  (state update, returns payout) **then**
  `token.transfer(vault, user, payout)`.

**Withdraw/early-exit ordering is the safe one, and it's the one that
matters most:** the vault decrements (or fully removes) the user's
`Balance`/`Shares` entries *before* `VaultRouter` ever moves a token back
to the user. Classic checks-effects-interactions. Even in a scenario
where the outbound token transfer could somehow trigger further
execution, a re-entrant call back into `withdraw` would see the
already-reduced balance and be rejected (`user_shares <= 0 || balance <=
0` / `amount > balance` both panic) rather than draining a second payout
against stale state.

**Deposit's ordering is technically interactions-before-effects** (token
moves before the vault's bookkeeping runs), but the direction of value
flow makes this low-risk in practice: deposit only ever *increases* the
vault's liability to the user, so a hypothetical reentrant call during
the transfer can't extract funds — at worst it could attempt a duplicate
deposit invocation, which is unprofitable to an attacker and bounded by
whatever real tokens they'd have to actually transfer to open the
position.

**Why the classic EVM reentrancy vector mostly doesn't apply here:**
Soroban's standard token interface (SEP-41 / the Stellar Asset Contract)
does not invoke arbitrary recipient code on `transfer` the way
ERC-777-style hooks do — a transfer is a synchronous balance update, not
a callback into the recipient. There is no fallback/receive-function
equivalent that fires implicitly. Combined with Soroban transactions
being atomic (a failed nested call unwinds the whole transaction, not
just a frame of it, unlike EVM's historical partial-revert reentrancy
patterns), the attack surface this review is extending from
`internal-2026-01.md` is narrower here than the equivalent EVM pattern.

**Residual risk, and where it's actually mitigated:** the only realistic
way a transfer-time callback fires is if a *non-standard*, deliberately
malicious token contract is used as the deposit asset — one that
implements `transfer` to call back into the caller. That risk is exactly
what `VaultRouter`'s asset allowlist (`is_asset_allowed`,
admin-gated `add_deposit_asset`/`remove_deposit_asset`) exists to
contain: the allowlist is the actual reentrancy control for this vector,
not a code-level guard inside the vaults. **Recommendation:** treat
adding a new asset to the allowlist as a security-sensitive action
requiring the same review rigor as a contract upgrade, not a routine
admin operation — the allowlist is doing real access-control work here,
not just a UX filter.

No code change is proposed from this section; it's a review, and the
existing ordering is correct where it matters (withdraw/early_exit).

---

## Recommendations for follow-up

1. `Harvester`'s entrypoints were not in this PR's scope (not touched by
   #138) and have not had an equivalent authorization pass — worth its
   own issue.
2. `GuardianMultisig` has no owner add/remove/rotate function; if one is
   added, it must explicitly decide how to handle in-flight confirmations
   naming a removed owner (see C-02's "known limitation").
3. `VaultRouter.vault_capacity`/`set_max_tvl` invoke a vault's
   `max_tvl`/`remaining_capacity`/`set_max_tvl` for every `Tier` including
   `Flex`, but `VaultFlex` does not implement those three functions —
   calling `vault_capacity(Tier::Flex)` or `set_max_tvl(Tier::Flex, ...)`
   would fail at runtime with no compile-time signal (Soroban's
   `invoke_contract` is dynamically dispatched by symbol name). This is a
   functional gap noticed during this review, not an authorization one —
   flagged here rather than fixed, since it's outside this issue's scope.
