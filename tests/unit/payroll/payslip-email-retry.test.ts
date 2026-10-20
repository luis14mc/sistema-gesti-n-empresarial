import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage, EmailTransport } from '@/platform/email/types';
import {
  classifyEmailFailure,
  sendEmailWithRetries,
  MAX_EMAIL_ATTEMPTS,
} from '@/modules/payroll/application/payslip-email-retry';

class FakeTransport implements EmailTransport {
  calls = 0;
  constructor(
    private readonly outcomes: Array<Error | { messageId: string }>,
  ) {}

  async send(_message: EmailMessage) {
    this.calls += 1;
    const outcome = this.outcomes[this.calls - 1] ?? { messageId: 'ok' };
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}

describe('payslip email retry policy', () => {
  it('sends successfully on first attempt', async () => {
    const transport = new FakeTransport([{ messageId: 'm-1' }]);
    const result = await sendEmailWithRetries(transport, {
      to: 'a@example.com',
      subject: 'Test',
      html: '<p>x</p>',
      text: 'x',
    });
    expect(result.messageId).toBe('m-1');
    expect(transport.calls).toBe(1);
  });

  it('retries transient errors then succeeds', async () => {
    vi.useFakeTimers();
    const transport = new FakeTransport([
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
      { messageId: 'm-2' },
    ]);
    const promise = sendEmailWithRetries(transport, {
      to: 'a@example.com',
      subject: 'Test',
      html: '<p>x</p>',
      text: 'x',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.messageId).toBe('m-2');
    expect(transport.calls).toBe(2);
    vi.useRealTimers();
  });

  it('does not retry permanent recipient errors', async () => {
    const transport = new FakeTransport([new Error('550 mailbox unavailable')]);
    await expect(
      sendEmailWithRetries(transport, {
        to: 'bad@example.com',
        subject: 'Test',
        html: '<p>x</p>',
        text: 'x',
      }),
    ).rejects.toThrow(/550/);
    expect(transport.calls).toBe(1);
  });

  it('classifies SMTP timeout as transient', () => {
    expect(classifyEmailFailure(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe('transient');
    expect(classifyEmailFailure(new Error('550 user unknown'))).toBe('permanent');
  });

  it(`stops after ${MAX_EMAIL_ATTEMPTS} transient attempts`, async () => {
    vi.useFakeTimers();
    try {
      const transport = new FakeTransport(
        Array.from({ length: MAX_EMAIL_ATTEMPTS }, () =>
          Object.assign(new Error('temporary'), { code: 'ECONNRESET' }),
        ),
      );
      const promise = sendEmailWithRetries(transport, {
        to: 'a@example.com',
        subject: 'Test',
        html: '<p>x</p>',
        text: 'x',
      });
      const assertion = expect(promise).rejects.toThrow(/temporary/);
      await vi.runAllTimersAsync();
      await assertion;
      expect(transport.calls).toBe(MAX_EMAIL_ATTEMPTS);
    } finally {
      vi.useRealTimers();
    }
  });
});
