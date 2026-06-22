/**
 * Default fallback constants for the dormitory billing engine.
 *
 * These values are used when no overriding record is found in the
 * `SettingRates` sheet.  Update the sheet (not these constants) to
 * change live rates without redeploying.
 */

/** Default electricity charge in Baht per kWh unit consumed. */
export const ELECTRIC_RATE_PER_UNIT = 5 as const;

/** Default flat-rate water charge in Baht per billing period. */
export const WATER_BILL_FIXED = 80 as const;
