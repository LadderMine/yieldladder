#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

fn setup() -> (Env, VaultL6Client<'static>) {
    let env = Env::default();
    let id = env.register_contract(None, VaultL6);
    let client = VaultL6Client::new(&env, &id);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &Address::generate(&env), &Address::generate(&env));
    (env, client)
}

#[test]
fn test_partial_withdraw_l6() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &2_000_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 1_555_200);
    let returned = client.withdraw(&user, &1_000_000_000_i128);
    assert_eq!(returned, 1_000_000_000);
    assert_eq!(client.balance(&user), 1_000_000_000);
}

#[test]
#[should_panic(expected = "AmountExceedsBalance")]
fn test_over_withdrawal_rejected_l6() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &1_000_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 1_555_200);
    client.withdraw(&user, &1_000_000_001_i128);
}

#[test]
fn test_partial_early_exit_l6_fee_on_amount_only() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &2_000_000_000_i128);
    // Exit 1 USDC (1_000_000_000 stroops); fee 1.25% = 12_500_000 -> net 987_500_000
    let net = client.early_exit(&user, &1_000_000_000_i128);
    assert_eq!(net, 987_500_000);
    assert_eq!(client.balance(&user), 1_000_000_000);
}