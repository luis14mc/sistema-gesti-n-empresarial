/**
 * CNI/server.py stores ISR tramo rates as whole percents (15, 20, 25) and divides by 100 at calc time.
 * SGE stores decimals (0.15) in seeds; normalize both on read.
 */
export function normalizeIsrRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return rate > 1 ? rate / 100 : rate;
}

/** IHSS tasas are stored as 2.5 meaning 2.5%; values like 250 are data-entry errors. */
export function normalizeIhssRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  if (rate > 10) {
    return rate / 100;
  }
  return rate;
}
