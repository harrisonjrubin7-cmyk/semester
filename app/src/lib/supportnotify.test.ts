import { describe, expect, it, vi } from 'vitest';
import { handleSupportNotice, type SupportNoticeDeps } from '../../../supabase/functions/_shared/supportnotify';

const origin = 'https://harrisonjrubin7-cmyk.github.io';
const ticket = '123e4567-e89b-42d3-a456-426614174000';

function deps(overrides: Partial<SupportNoticeDeps> = {}): SupportNoticeDeps {
  return {
    allowedOrigin: origin,
    resendKey: 'configured',
    appUrl: `${origin}/semester/`,
    userFromToken: vi.fn().mockResolvedValue('agent'),
    mayAnswer: vi.fn().mockResolvedValue(true),
    notice: vi.fn().mockResolvedValue({ messageId: 'message-1', email: 'student@example.test' }),
    send: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const request = (body: unknown = { ticket_id: ticket }) => new Request('https://project.supabase.co/functions/v1/support-reply-notify', {
  method: 'POST',
  headers: { Origin: origin, Authorization: 'Bearer session', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('support reply notification', () => {
  it('sends a generic, idempotent hint without the reply body', async () => {
    const d = deps();
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(200);
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'student@example.test',
      idempotencyKey: 'support-message-1',
      subject: '[Semester] Support replied to SUP-123E4567',
    }));
    const text = vi.mocked(d.send).mock.calls[0][0].text;
    expect(text).toContain('/semester/');
    expect(text).not.toContain('agent');
  });

  it('refuses callers without the support capability before looking up a ticket', async () => {
    const d = deps({ mayAnswer: vi.fn().mockResolvedValue(false) });
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(403);
    expect(d.notice).not.toHaveBeenCalled();
  });

  it('fails closed for an unapproved origin or absent email configuration', async () => {
    const d = deps();
    const wrong = new Request(request().url, { method: 'POST', headers: { Origin: 'https://evil.example', Authorization: 'Bearer session' }, body: JSON.stringify({ ticket_id: ticket }) });
    expect((await handleSupportNotice(wrong, d)).status).toBe(403);
    expect((await handleSupportNotice(request(), deps({ resendKey: undefined }))).status).toBe(503);
  });
});
