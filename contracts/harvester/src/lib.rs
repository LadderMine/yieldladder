#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// Harvester is a permissionless contract that claims accumulated trading fees
/// from the Stellar AMM liquidity pools allocated by the Strategy Vault.
///
/// Anyone may call `harvest()` once the cooldown period has elapsed. The caller
/// receives a bounty of 10 basis points (0.10%) of the total harvested yield as
/// an incentive for timely execution, without requiring a privileged keeper role.
/// Harvested USDC is compounded back into the Strategy Vault automatically.
#[contract]
pub struct Harvester;

#[contractimpl]
impl Harvester {
    // harvest() — permissionless; claims AMM trading fees and compounds into StrategyVault.
    // Caller receives 10 bps bounty on harvested yield.
    // Full implementation in subsequent commits.
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn contract_instantiates() {
        let env = Env::default();
        let _id = env.register_contract(None, Harvester);
    }
}
