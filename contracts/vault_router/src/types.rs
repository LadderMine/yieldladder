#![no_std]
use soroban_sdk::Symbol;

/// The name of a vault tier (e.g. "Flex", "L3", "L6", "L12").
pub type TierName = Symbol;

/// Non-transferable share-units representing a depositor's claim on a tier vault.
/// Computed as `deposit_amount * lock_multiplier` at deposit time.
pub type Shares = i128;

/// Unix timestamp after which a locked position may be withdrawn without fee.
/// `None` for the Flex tier (no lock).
pub type LockUntil = u64;
