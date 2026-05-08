#![no_std]
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    /// The requested tier name is not one of Flex, L3, L6, or L12.
    InvalidTier = 1,
    /// The deposit amount is below the tier's minimum deposit requirement.
    BelowMinDeposit = 2,
    /// The position's lock period has not yet elapsed; early exit required.
    LockNotExpired = 3,
}
