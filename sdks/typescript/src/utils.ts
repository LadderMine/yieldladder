/**
 * Formats a raw USDC amount string to a human-readable decimal string
 * with exactly 2 decimal places.
 *
 * USDC on Stellar uses 7 decimal places of precision (stroops-equivalent),
 * but display convention is 2 decimal places.
 *
 * @param amount - The amount as a decimal string (e.g. "500.0000000" or "500").
 * @returns A string formatted to 2 decimal places (e.g. "500.00").
 */
export function formatUSDC(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    throw new Error(`Invalid USDC amount: "${amount}"`);
  }
  return num.toFixed(2);
}
