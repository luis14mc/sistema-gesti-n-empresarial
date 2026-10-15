import { PayrollInvalidRateUnitsError } from './errors';

/** ISR bracket rates must be whole percents (15), not fractions (0.15). */
export function assertIsrRatesArePercentUnits(rates: number[]): void {
  for (const rate of rates) {
    if (rate > 0 && rate < 1) {
      throw new PayrollInvalidRateUnitsError();
    }
  }
}
