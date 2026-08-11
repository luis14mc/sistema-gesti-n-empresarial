// Phase 10B — domain unit tests for notification rules.
import { describe, expect, it } from 'vitest';
import {
  getNotificationRule,
  listNotificationRules,
  NOTIFICATION_RULES,
} from '@/modules/notifications/domain/rules';

describe('NOTIFICATION_RULES catalogue', () => {
  it('exposes a rule for every documented lifecycle event', () => {
    const expectedEvents = [
      'organization.lifecycle.created',
      'organization.lifecycle.activated',
      'organization.lifecycle.suspended',
      'organization.lifecycle.reactivated',
      'organization.lifecycle.archived',
      'organization.lifecycle.closure_requested',
    ] as const;
    for (const eventType of expectedEvents) {
      expect(NOTIFICATION_RULES[eventType]).toBeDefined();
    }
  });

  it('marks suspended, archived, and closure-requested events as mandatory', () => {
    expect(NOTIFICATION_RULES['organization.lifecycle.suspended'].mandatory).toBe(true);
    expect(NOTIFICATION_RULES['organization.lifecycle.archived'].mandatory).toBe(true);
    expect(NOTIFICATION_RULES['organization.lifecycle.closure_requested'].mandatory).toBe(true);
  });

  it('does not mark non-critical events as mandatory', () => {
    expect(NOTIFICATION_RULES['organization.lifecycle.created'].mandatory).toBe(false);
    expect(NOTIFICATION_RULES['organization.lifecycle.activated'].mandatory).toBe(false);
    expect(NOTIFICATION_RULES['organization.lifecycle.reactivated'].mandatory).toBe(false);
  });

  it('routes mandatory alerts to either owners OR admins', () => {
    const suspended = NOTIFICATION_RULES['organization.lifecycle.suspended'];
    const recipientKinds = suspended.recipients.map((r) => r.kind).sort();
    expect(recipientKinds).toEqual(['organization-admins', 'organization-owners']);
  });

  it('routes closure-requested alerts to admins only', () => {
    const rule = NOTIFICATION_RULES['organization.lifecycle.closure_requested'];
    expect(rule.recipients).toHaveLength(1);
    expect(rule.recipients[0].kind).toBe('organization-admins');
  });

  it('includes EMAIL channel for mandatory alerts', () => {
    expect(NOTIFICATION_RULES['organization.lifecycle.suspended'].channels).toContain('EMAIL');
    expect(NOTIFICATION_RULES['organization.lifecycle.archived'].channels).toContain('EMAIL');
    expect(NOTIFICATION_RULES['organization.lifecycle.closure_requested'].channels).toContain('EMAIL');
  });

  it('every rule has a default title, body, and internal action path', () => {
    for (const rule of listNotificationRules()) {
      expect(rule.defaultTitle).toBeTruthy();
      expect(rule.defaultBody).toBeTruthy();
      expect(rule.defaultActionPath).toBeTruthy();
      expect(rule.defaultActionPath).toMatch(/^\//);
    }
  });
});

describe('getNotificationRule', () => {
  it('returns the same object as the catalogue entry', () => {
    expect(getNotificationRule('organization.lifecycle.suspended'))
      .toBe(NOTIFICATION_RULES['organization.lifecycle.suspended']);
  });
});
