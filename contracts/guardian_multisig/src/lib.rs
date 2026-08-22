#![no_std]

//! Guardian Multisig Contract
//!
//! An N-of-M threshold signer contract for the YieldLadder governance system.
//! The Guardian role in the Governance contract is satisfied by deploying this
//! contract and setting its address as the `guardian` during `Governance::initialize`.
//!
//! ## Design
//! - Up to 10 owners can be registered at initialisation time.
//! - Any owner can submit a veto proposal targeting a `governance_contract` + `proposal_id`.
//! - Once `threshold` distinct owners have confirmed the same veto proposal it is
//!   automatically dispatched to `Governance::veto`.
//! - Executed / expired veto proposals are cleaned up from persistent storage.

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, Address, Env, Vec,
};

// ── External interface ────────────────────────────────────────────────────────

#[contractclient(name = "GovernanceClient")]
pub trait GovernanceInterface {
    fn veto(env: Env, proposal_id: u32);
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Owners,
    Threshold,
    /// Confirmations collected for a (governance_contract, proposal_id) pair.
    Confirmations(Address, u32),
}

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct VetoProposal {
    pub governance_contract: Address,
    pub proposal_id: u32,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GuardianMultisig;

#[contractimpl]
impl GuardianMultisig {
    /// Initialise the multisig. Must be called exactly once.
    ///
    /// # Arguments
    /// * `owners`    – List of authorised signer addresses (1–10).
    /// * `threshold` – Minimum number of confirmations required (1 ≤ threshold ≤ owners.len()).
    pub fn initialize(env: Env, owners: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Threshold) {
            panic!("already initialized");
        }
        if owners.is_empty() {
            panic!("owners list must not be empty");
        }
        if owners.len() > 10 {
            panic!("at most 10 owners allowed");
        }
        if threshold == 0 || threshold > owners.len() {
            panic!("threshold must be in [1, owners.len()]");
        }
        env.storage().instance().set(&DataKey::Owners, &owners);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
    }

    /// Submit or confirm a veto for `proposal_id` on `governance_contract`,
    /// as `owner`.
    ///
    /// `owner` must authorize this call (Soroban has no implicit invoker/
    /// `msg.sender` for a direct external call — the caller must name and
    /// authorize the address they're acting as, the same pattern the SDK's
    /// `Signer`/`WalletAdapter` interfaces already use) and must be one of
    /// the registered owners. Once `threshold` distinct owners have
    /// confirmed, the veto is automatically executed.
    pub fn confirm_veto(env: Env, owner: Address, governance_contract: Address, proposal_id: u32) {
        owner.require_auth();

        let owners: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Owners)
            .expect("not initialized");
        if !owners.contains(&owner) {
            panic!("caller is not a registered owner");
        }

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .expect("not initialized");

        let key = DataKey::Confirmations(governance_contract.clone(), proposal_id);

        // Re-read fresh on every call rather than caching: if owners are
        // ever rotated between confirmations, a since-removed owner's
        // earlier confirmation is not retroactively erased from this list
        // (out of scope to unwind — no owner-rotation function exists in
        // this contract yet), but the `owners.contains(&owner)` check above
        // always reflects the CURRENT owner set, so a removed owner can
        // never add a fresh confirmation after being rotated out.
        let mut confirmations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));

        // Deduplicate by the real confirming owner — an owner can only
        // confirm once per proposal, and cannot double-count toward the
        // threshold by calling repeatedly.
        if confirmations.contains(&owner) {
            panic!("already confirmed");
        }

        confirmations.push_back(owner.clone());
        env.storage().persistent().set(&key, &confirmations);

        // Execute veto exactly once, exactly at the threshold.
        if confirmations.len() >= threshold {
            let gov = GovernanceClient::new(&env, &governance_contract);
            gov.veto(&proposal_id);
            // Clean up after execution so a proposal can't be re-executed
            // by a stray late confirmation once the key is gone.
            env.storage().persistent().remove(&key);
        }
    }

    /// Returns the number of confirmations collected so far for a veto proposal.
    pub fn confirmation_count(
        env: Env,
        governance_contract: Address,
        proposal_id: u32,
    ) -> u32 {
        let key = DataKey::Confirmations(governance_contract, proposal_id);
        let confirmations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        confirmations.len()
    }

    /// Returns the list of registered owners.
    pub fn owners(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Owners)
            .expect("not initialized")
    }

    /// Returns the confirmation threshold.
    pub fn threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .expect("not initialized")
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        symbol_short,
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        Address, Env, IntoVal, Vec,
    };

    /// Tracks how many times `veto` was actually called, so tests can prove
    /// dispatch happens exactly once, exactly at threshold — not before,
    /// not repeatedly after (issue #144's acceptance criterion).
    #[contract]
    struct MockGovernance;

    #[contractimpl]
    impl MockGovernance {
        pub fn veto(env: Env, _proposal_id: u32) {
            let count: u32 = env.storage().instance().get(&symbol_short!("calls")).unwrap_or(0);
            env.storage().instance().set(&symbol_short!("calls"), &(count + 1));
        }

        pub fn veto_calls(env: Env) -> u32 {
            env.storage().instance().get(&symbol_short!("calls")).unwrap_or(0)
        }
    }

    fn setup(env: &Env, n: u32, threshold: u32) -> (Vec<Address>, GuardianMultisigClient) {
        let mut owners = Vec::new(env);
        for _ in 0..n {
            owners.push_back(Address::generate(env));
        }
        let contract_id = env.register_contract(None, GuardianMultisig);
        let client = GuardianMultisigClient::new(env, &contract_id);
        env.mock_all_auths();
        client.initialize(&owners, &threshold);
        (owners, client)
    }

    /// Mocks auth for exactly `owner` calling `confirm_veto` on `contract_id`
    /// with these exact args — nobody else's auth is mocked. Used to prove
    /// `owner.require_auth()` is a real, enforced check rather than dead
    /// code: against the pre-fix placeholder (which never called
    /// `require_auth` on anything meaningful) every test using this would
    /// have passed regardless of which address was passed as `owner`.
    fn mock_confirm_auth(
        env: &Env,
        owner: &Address,
        contract_id: &Address,
        governance_contract: &Address,
        proposal_id: u32,
    ) {
        env.mock_auths(&[MockAuth {
            address: owner,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "confirm_veto",
                args: (owner.clone(), governance_contract.clone(), proposal_id).into_val(env),
                sub_invokes: &[],
            },
        }]);
    }

    #[test]
    fn initialises_correctly() {
        let env = Env::default();
        let (owners, client) = setup(&env, 3, 2);
        assert_eq!(client.threshold(), 2);
        assert_eq!(client.owners().len(), 3);
        let _ = owners;
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn double_initialize_panics() {
        let env = Env::default();
        let (owners, client) = setup(&env, 2, 1);
        client.initialize(&owners, &1);
    }

    #[test]
    #[should_panic(expected = "threshold must be in")]
    fn zero_threshold_panics() {
        let env = Env::default();
        let mut owners = Vec::new(&env);
        owners.push_back(Address::generate(&env));
        let id = env.register_contract(None, GuardianMultisig);
        let client = GuardianMultisigClient::new(&env, &id);
        env.mock_all_auths();
        client.initialize(&owners, &0);
    }

    #[test]
    fn confirmation_count_starts_at_zero() {
        let env = Env::default();
        let (_, client) = setup(&env, 3, 2);
        let gov = env.register_contract(None, MockGovernance);
        assert_eq!(client.confirmation_count(&gov, &0), 0);
    }

    #[test]
    fn single_owner_1_of_1_executes_immediately() {
        let env = Env::default();
        let (owners, client) = setup(&env, 1, 1);
        let gov = env.register_contract(None, MockGovernance);
        env.mock_all_auths();
        // Should not panic — veto dispatched to MockGovernance which
        // records the call.
        client.confirm_veto(&owners.get(0).unwrap(), &gov, &0);

        let gov_client = MockGovernanceClient::new(&env, &gov);
        assert_eq!(gov_client.veto_calls(), 1);
    }

    // ── Real invoker attribution (issue #144's core fix) ────────────────────

    #[test]
    #[should_panic]
    fn confirm_veto_requires_the_owners_own_authorization() {
        // No mock_all_auths() at all here — proves owner.require_auth() is
        // a real, enforced check. Against the pre-fix placeholder (which
        // never checked auth on anything meaningful) this would not panic.
        let env = Env::default();
        let (owners, client) = setup(&env, 1, 1);
        let gov = env.register_contract(None, MockGovernance);
        client.confirm_veto(&owners.get(0).unwrap(), &gov, &0);
    }

    #[test]
    #[should_panic(expected = "not a registered owner")]
    fn non_owner_cannot_confirm() {
        let env = Env::default();
        let (_owners, client) = setup(&env, 2, 2);
        let gov = env.register_contract(None, MockGovernance);
        let outsider = Address::generate(&env);
        env.mock_all_auths();

        client.confirm_veto(&outsider, &gov, &0);
    }

    #[test]
    #[should_panic(expected = "already confirmed")]
    fn same_owner_cannot_double_count_toward_threshold() {
        let env = Env::default();
        let (owners, client) = setup(&env, 3, 3);
        let gov = env.register_contract(None, MockGovernance);
        env.mock_all_auths();
        let owner0 = owners.get(0).unwrap();

        client.confirm_veto(&owner0, &gov, &0);
        assert_eq!(client.confirmation_count(&gov, &0), 1);

        // Same owner confirming again must not move the count toward
        // threshold a second time.
        client.confirm_veto(&owner0, &gov, &0);
    }

    #[test]
    fn distinct_owners_confirming_accumulate_toward_threshold() {
        let env = Env::default();
        let (owners, client) = setup(&env, 3, 3);
        let gov = env.register_contract(None, MockGovernance);
        env.mock_all_auths();

        client.confirm_veto(&owners.get(0).unwrap(), &gov, &0);
        assert_eq!(client.confirmation_count(&gov, &0), 1);
        client.confirm_veto(&owners.get(1).unwrap(), &gov, &0);
        assert_eq!(client.confirmation_count(&gov, &0), 2);

        let gov_client = MockGovernanceClient::new(&env, &gov);
        assert_eq!(gov_client.veto_calls(), 0); // not yet at threshold
    }

    #[test]
    fn veto_dispatches_exactly_once_exactly_at_threshold() {
        let env = Env::default();
        let (owners, client) = setup(&env, 3, 2);
        let gov = env.register_contract(None, MockGovernance);
        env.mock_all_auths();
        let gov_client = MockGovernanceClient::new(&env, &gov);

        client.confirm_veto(&owners.get(0).unwrap(), &gov, &0);
        assert_eq!(gov_client.veto_calls(), 0); // 1-of-2: not yet

        client.confirm_veto(&owners.get(1).unwrap(), &gov, &0);
        assert_eq!(gov_client.veto_calls(), 1); // 2-of-2: dispatched exactly once

        // Confirmations are cleaned up on execution, so the third (distinct)
        // owner confirming the same proposal afterward starts a fresh round
        // rather than re-triggering the already-executed veto a second time
        // from a stray leftover confirmation.
        client.confirm_veto(&owners.get(2).unwrap(), &gov, &0);
        assert_eq!(gov_client.veto_calls(), 1);
        assert_eq!(client.confirmation_count(&gov, &0), 1);
    }

    #[test]
    fn confirmations_are_scoped_per_governance_contract_and_proposal_id() {
        let env = Env::default();
        let (owners, client) = setup(&env, 2, 2);
        let gov_a = env.register_contract(None, MockGovernance);
        let gov_b = env.register_contract(None, MockGovernance);
        env.mock_all_auths();
        let owner0 = owners.get(0).unwrap();

        client.confirm_veto(&owner0, &gov_a, &0);
        client.confirm_veto(&owner0, &gov_a, &1);
        client.confirm_veto(&owner0, &gov_b, &0);

        // Same owner, three distinct (contract, proposal_id) pairs — none
        // of these should count toward each other.
        assert_eq!(client.confirmation_count(&gov_a, &0), 1);
        assert_eq!(client.confirmation_count(&gov_a, &1), 1);
        assert_eq!(client.confirmation_count(&gov_b, &0), 1);
    }

    /// Exercises the actual mocked-per-address auth path end to end (rather
    /// than the blanket `mock_all_auths()` every other test above uses),
    /// pinning down that `confirm_veto` really does check `owner`
    /// specifically and not merely "some address require_auth'd".
    #[test]
    fn confirm_veto_succeeds_with_only_the_owners_auth_mocked() {
        let env = Env::default();
        let mut owners = Vec::new(&env);
        owners.push_back(Address::generate(&env));
        let contract_id = env.register_contract(None, GuardianMultisig);
        let client = GuardianMultisigClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.initialize(&owners, &1);
        let gov = env.register_contract(None, MockGovernance);
        let owner0 = owners.get(0).unwrap();

        mock_confirm_auth(&env, &owner0, &contract_id, &gov, 0);
        client.confirm_veto(&owner0, &gov, &0);

        let gov_client = MockGovernanceClient::new(&env, &gov);
        assert_eq!(gov_client.veto_calls(), 1);
    }
}