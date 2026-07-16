#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

fn setup() -> (Env, VaultL3Client<'static>) {
    let env = Env::default();
    let id = env.register_contract(None, VaultL3);
    let client = VaultL3Client::new(&env, &id);
    let admin = Address::generate(&env);
    let strategy = Address::generate(&env);
    let usdc = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &strategy, &usdc);
    (env, client)
}

#[test]
fn test_partial_withdraw_reduces_position() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &1_000_000_000_i128);
    // Fast-forward past lock
    env.ledger().set_sequence(env.ledger().sequence() + 777_600);
    // Withdraw half
    let returned = client.withdraw(&user, &500_000_000_i128);
    assert_eq!(returned, 500_000_000);
    assert_eq!(client.balance(&user), 500_000_000);
    // LockUntil still set (position not fully closed)
    assert!(client.lock_until(&user) > 0);
}

#[test]
fn test_full_amount_partial_withdraw_equals_full_withdraw() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &500_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 777_600);
    // Pass exact balance — should behave like full withdrawal
    let returned = client.withdraw(&user, &500_000_000_i128);
    assert_eq!(returned, 500_000_000);
    assert_eq!(client.balance(&user), 0);
    assert_eq!(client.shares(&user), 0);
    assert_eq!(client.lock_until(&user), 0);
}

#[test]
#[should_panic(expected = "AmountExceedsBalance")]
fn test_over_withdrawal_rejected() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &500_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 777_600);
    client.withdraw(&user, &500_000_001_i128);
}

#[test]
fn test_partial_early_exit_fee_on_withdrawn_amount_only() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &1_000_000_000_i128);
    // Early exit 500 USDC — fee 0.5% = 2_500_000 → net 497_500_000
    let net = client.early_exit(&user, &500_000_000_i128);
    assert_eq!(net, 497_500_000);
    // Remaining balance untouched
    assert_eq!(client.balance(&user), 500_000_000);
}

#[test]
#[should_panic(expected = "AmountExceedsBalance")]
fn test_over_early_exit_rejected() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &500_000_000_i128);
    client.early_exit(&user, &500_000_001_i128);
}

#[test]
#[should_panic(expected = "LockNotExpired")]
fn test_withdraw_before_lock_fails() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &500_000_000_i128);
    client.withdraw(&user, &100_000_000_i128);
}