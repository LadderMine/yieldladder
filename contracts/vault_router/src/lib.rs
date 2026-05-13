#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// VaultRouter is the user-facing entry point for the YieldLadder protocol.
///
/// It routes deposit, withdrawal, and early-exit operations to the appropriate
/// tier vault (ault_l3, ault_l6, or ault_l12) based on the lock-up
/// period chosen by the user. All share minting and yield accounting is
/// delegated to the selected tier vault.
#[contract]
pub struct VaultRouter;

#[contractimpl]
impl VaultRouter {
    // deposit(tier, amount) — validate tier rules, mint shares, forward to tier vault.
    // withdraw(tier)         — return principal + yield after lock_until.
    // early_exit(tier)       — return principal minus exit fee before lock_until.
    // Full implementation in subsequent commits.
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn contract_instantiates() {
        let env = Env::default();
        let _id = env.register_contract(None, VaultRouter);
    }
}