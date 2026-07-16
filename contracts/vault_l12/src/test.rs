#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

fn setup() -> (Env, VaultL12Client<'static>) {
    let env = Env::default();
    let id = env.register_contract(None, VaultL12);
    let client = VaultL12Client::new(&env, &id);
    env.mock_all_auths();
    client.initialize(&Address::generate(&env), &Address::generate(&env), &Address::generate(&env));
    (env, client)
}

#[test]
fn test_partial_withdraw_l12() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &5_000_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 3_110_400);
    let returned = client.withdraw(&user, &2_500_000_000_i128);
    assert_eq!(returned, 2_500_000_000);
    assert_eq!(client.balance(&user), 2_500_000_000);
}

#[test]
#[should_panic(expected = "AmountExceedsBalance")]
fn test_over_withdrawal_rejected_l12() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &2_500_000_000_i128);
    env.ledger().set_sequence(env.ledger().sequence() + 3_110_400);
    client.withdraw(&user, &2_500_000_001_i128);
}

#[test]
fn test_partial_early_exit_l12_fee_on_amount_only() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    env.mock_all_auths();
    client.deposit(&user, &5_000_000_000_i128);
    // Exit 2_500_000_000; fee 2.5% = 62_500_000 -> net 2_437_500_000
    let net = client.early_exit(&user, &2_500_000_000_i128);
    assert_eq!(net, 2_437_500_000);
    assert_eq!(client.balance(&user), 2_500_000_000);
}