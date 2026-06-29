#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};
use shared::fixed_point::{mul_fp, div_fp, SCALING_FACTOR};
use shared::checkpoint::{record_deposit_checkpoint, is_eligible_for_yield};

// Storage keys setup using Soroban instance and persistent frameworks
const ADMIN_KEY: Symbol = symbol_short!("admin");
const STRATEGY_KEY: Symbol = symbol_short!("strategy");
const TOTAL_SHARES_KEY: Symbol = symbol_short!("t_shares");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Balance(Address),
    Shares(Address),
}

#[contract]
pub struct VaultFlex;

#[contractimpl]
impl VaultFlex {
    /// One-time initialization. Sets admin (VaultRouter) and strategy constraints.
    pub fn initialize(env: Env, admin: Address, strategy: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("VaultFlex: Contract instance already initialized");
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&STRATEGY_KEY, &strategy);
        env.storage().instance().set(&TOTAL_SHARES_KEY, &0i128);
    }

    /// Deposits USDC capital for a target user. Can only be invoked by the registered Admin.
    pub fn deposit(env: Env, user: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).expect("Uninitialized");
        admin.require_auth(); // Authorization Restriction: Only VaultRouter/Admin can call

        // Acceptance Criteria: Rejects any volume beneath 1.0000000 USDC (1 Stroop Unit Scalar)
        if amount < SCALING_FACTOR {
            panic!("VaultFlex: Deposit amount below minimum requirement of 1 USDC");
        }

        let current_balance = env.storage().persistent().get::<DataKey, i128>(&DataKey::Balance(user.clone())).unwrap_or(0);
        let current_shares = env.storage().persistent().get::<DataKey, i128>(&DataKey::Shares(user.clone())).unwrap_or(0);
        let total_shares = env.storage().instance().get::<Symbol, i128>(&TOTAL_SHARES_KEY).unwrap_or(0);

        // Flex tier features a constant 1.00x share multiplier
        let structural_shares = amount; 

        // Commit state parameters to persistent ledger
        env.storage().persistent().set(&DataKey::Balance(user.clone()), &(current_balance + amount));
        env.storage().persistent().set(&DataKey::Shares(user.clone()), &(current_shares + structural_shares));
        env.storage().instance().set(&TOTAL_SHARES_KEY, &(total_shares + structural_shares));

        // Audit M-01 Safeguard: Log checkpoint rule delay sequence via shared infrastructure
        record_deposit_checkpoint(&env, &user);
    }

    /// Withdraws a user's entire position, calculating accrued yield dynamically. Only callable by Admin.
    pub fn withdraw(env: Env, user: Address, strategy_balance: i128) -> i128 {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).expect("Uninitialized");
        admin.require_auth();

        let user_shares = env.storage().persistent().get::<DataKey, i128>(&DataKey::Shares(user.clone())).unwrap_or(0);
        if user_shares <= 0 {
            panic!("VaultFlex: Zero share profile detected or double-withdraw requested");
        }

        let total_shares = env.storage().instance().get::<Symbol, i128>(&TOTAL_SHARES_KEY).unwrap_or(0);
        let principal_balance = env.storage().persistent().get::<DataKey, i128>(&DataKey::Balance(user.clone())).unwrap_or(0);

        // Calculate pro-rata yields: (user_shares / total_shares) * strategy_balance
        let total_payout = if is_eligible_for_yield(&env, &user) && total_shares > 0 {
            // High-precision fixed-point multiplication/division prevents early truncation errors
            div_fp(mul_fp(user_shares, strategy_balance), total_shares)
        } else {
            principal_balance
        };

        // Complete state destruction for the user's position
        env.storage().persistent().remove(&DataKey::Balance(user.clone()));
        env.storage().persistent().remove(&DataKey::Shares(user.clone()));
        env.storage().instance().set(&TOTAL_SHARES_KEY, &(total_shares - user_shares));

        total_payout
    }

    /* --- Read-Only Query Methods --- */

    pub fn balance(env: Env, user: Address) -> i128 {
        env.storage().persistent().get::<DataKey, i128>(&DataKey::Balance(user)).unwrap_or(0)
    }

    pub fn shares(env: Env, user: Address) -> i128 {
        env.storage().persistent().get::<DataKey, i128>(&DataKey::Shares(user)).unwrap_or(0)
    }

    pub fn total_shares(env: Env) -> i128 {
        env.storage().instance().get::<Symbol, i128>(&TOTAL_SHARES_KEY).unwrap_or(0)
    }
}