#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    BelowMinDeposit = 2,
    LockNotExpired = 3,
    PositionNotFound = 4,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    PositionCount(Address),
    Position(Address, u32),
    TotalShares,
    Admin,
    Strategy,
    Usdc,
}

#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub principal: i128,
    pub shares: i128,
    pub lock_until: u32,
    pub checkpoint: u32,
}

const FP_MULTIPLIER: i128 = 1_000_000_0;

pub fn mul_fp(a: i128, b_fp: i128) -> i128 {
    (a * b_fp) / FP_MULTIPLIER
}

#[contract]
pub struct VaultL12;

#[contractimpl]
impl VaultL12 {
    pub fn initialize(env: Env, admin: Address, strategy: Address, usdc: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Strategy, &strategy);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage().instance().set(&DataKey::TotalShares, &0i128);
    }

    pub fn deposit(env: Env, user: Address, amount: i128) -> u32 {
        user.require_auth();
        
        if amount < 2_500_000_000 {
            panic_with_error!(&env, VaultError::BelowMinDeposit);
        }

        let multiplier_fp = 14_000_000;
        let new_shares = mul_fp(amount, multiplier_fp);

        let usdc_addr: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        let strategy: Address = env.storage().instance().get(&DataKey::Strategy).unwrap();
        
        let token_client = token::Client::new(&env, &usdc_addr);
        token_client.transfer(&user, &strategy, &amount);

        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        let position_id = position_count;

        let lock_duration = 3_110_400;
        let lock_until = env.ledger().sequence() + lock_duration;
        let checkpoint = env.ledger().sequence() + 1;

        let position = Position {
            principal: amount,
            shares: new_shares,
            lock_until,
            checkpoint,
        };

        env.storage().persistent().set(&DataKey::Position(user.clone(), position_id), &position);
        env.storage().persistent().set(&DataKey::PositionCount(user.clone()), &(position_count + 1));
        
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalShares, &(total_shares + new_shares));

        position_id
    }

    pub fn withdraw(env: Env, user: Address, position_id: u32) -> i128 {
        user.require_auth();

        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        if position_id >= position_count {
            panic_with_error!(&env, VaultError::PositionNotFound);
        }

        let mut position: Position = env.storage().persistent().get(&DataKey::Position(user.clone(), position_id)).unwrap();
        if position.principal == 0 {
            return 0;
        }

        if env.ledger().sequence() < position.lock_until {
            panic_with_error!(&env, VaultError::LockNotExpired);
        }

        let principal = position.principal;
        let shares = position.shares;

        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalShares, &(total_shares - shares));

        position.principal = 0;
        position.shares = 0;
        env.storage().persistent().set(&DataKey::Position(user.clone(), position_id), &position);

        principal
    }

    pub fn early_exit(env: Env, user: Address, position_id: u32) -> i128 {
        user.require_auth();

        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        if position_id >= position_count {
            panic_with_error!(&env, VaultError::PositionNotFound);
        }

        let mut position: Position = env.storage().persistent().get(&DataKey::Position(user.clone(), position_id)).unwrap();
        if position.principal == 0 {
            return 0;
        }

        let exit_fee_fp = 300_000;
        let fee = mul_fp(position.principal, exit_fee_fp);
        let net_amount = position.principal - fee;

        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalShares, &(total_shares - position.shares));

        position.principal = 0;
        position.shares = 0;
        env.storage().persistent().set(&DataKey::Position(user.clone(), position_id), &position);

        net_amount
    }

    pub fn positions(env: Env, user: Address) -> Vec<Position> {
        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        let mut result = Vec::new(&env);
        for i in 0..position_count {
            let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone(), i)).unwrap();
            if position.principal > 0 {
                result.push_back(position);
            }
        }
        result
    }

    pub fn balance(env: Env, user: Address) -> i128 {
        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        let mut total = 0i128;
        for i in 0..position_count {
            let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone(), i)).unwrap();
            total += position.principal;
        }
        total
    }

    pub fn shares(env: Env, user: Address) -> i128 {
        let position_count: u32 = env.storage().persistent().get(&DataKey::PositionCount(user.clone())).unwrap_or(0);
        let mut total = 0i128;
        for i in 0..position_count {
            let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone(), i)).unwrap();
            total += position.shares;
        }
        total
    }

    pub fn total_shares(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }
}
