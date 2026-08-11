// Phase 10B — domain unit tests for the equipment asset-code resolver.
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_CODE_PREFIX,
  CATEGORY_LABELS,
  resolveEquipmentCategory,
} from '@/lib/equipment-asset-code';

describe('CATEGORY_CODE_PREFIX catalogue', () => {
  it('maps every documented category to a non-empty prefix', () => {
    expect(CATEGORY_CODE_PREFIX.DESKTOP_PC).toBe('PC');
    expect(CATEGORY_CODE_PREFIX.LAPTOP).toBe('LAP');
    expect(CATEGORY_CODE_PREFIX.PRINTER).toBe('IMP');
    expect(CATEGORY_CODE_PREFIX.PHONE).toBe('TEL');
    expect(CATEGORY_CODE_PREFIX.MONITOR).toBe('MON');
    expect(CATEGORY_CODE_PREFIX.UPS).toBe('UPS');
    expect(CATEGORY_CODE_PREFIX.ACCESSORY).toBe('ACC');
    expect(CATEGORY_CODE_PREFIX.OTHER).toBe('OTR');
  });

  it('only exposes documented prefixes', () => {
    const allowedPrefixes = ['PC', 'LAP', 'IMP', 'TEL', 'MON', 'UPS', 'ACC', 'OTR'];
    for (const value of Object.values(CATEGORY_CODE_PREFIX)) {
      expect(allowedPrefixes).toContain(value);
    }
  });
});

describe('CATEGORY_LABELS catalogue', () => {
  it('exposes a Spanish label for every category', () => {
    for (const key of Object.keys(CATEGORY_CODE_PREFIX) as Array<keyof typeof CATEGORY_CODE_PREFIX>) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
    }
  });
});

describe('resolveEquipmentCategory', () => {
  it('passes through a canonical Prisma category', () => {
    expect(resolveEquipmentCategory('LAPTOP')).toBe('LAPTOP');
    expect(resolveEquipmentCategory('DESKTOP_PC')).toBe('DESKTOP_PC');
  });

  it('maps the legacy DESKTOP alias to DESKTOP_PC', () => {
    expect(resolveEquipmentCategory('DESKTOP')).toBe('DESKTOP_PC');
  });

  it('maps the legacy TABLET alias to OTHER', () => {
    expect(resolveEquipmentCategory('TABLET')).toBe('OTHER');
  });

  it('falls back to OTHER when the category is unknown and no legacy type is given', () => {
    expect(resolveEquipmentCategory('ROCKET')).toBe('OTHER');
    expect(resolveEquipmentCategory(undefined)).toBe('OTHER');
  });

  it('honours the legacy type when the category is missing or unknown', () => {
    expect(resolveEquipmentCategory(undefined, 'PRINTER')).toBe('PRINTER');
    expect(resolveEquipmentCategory('UNKNOWN', 'LAPTOP')).toBe('LAPTOP');
  });
});
