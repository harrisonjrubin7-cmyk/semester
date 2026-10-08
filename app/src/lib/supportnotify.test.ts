import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleSupportNotice, type SupportNoticeDeps } from '../../../supabase/functions/_shared/supportnotify';

const origin = 'https://harrisonjrubin7-cmyk.github.io';
const ticket = '123e4567-e89b-42d3-a456-426614174000';
const claim = '223e4567-e89b-42d3-a456-426614174000';
const message = '323e4567-e89b-42d3-a456-426614174000';

function deps(overrides: Partial<SupportNoticeDeps> = {}): SupportNoticeDeps {
  return {
    allowedOrigin: origin,
    resendKey: 'configured',
    appUrl: `${origin}/semester/`,
    userFromToken: vi.fn().mockResolvedValue('agent'),
    mayAnswer: vi.fn().mockResolvedValue(true),
    notice: vi.fn().mockResolvedValue({ messageId: 'message-1', ticketId: ticket, claimId: claim, email: 'student@example.test', attempts: 0 }),
    unavailable: vi.fn().mockResolvedValue('cancelled'),
    pending: vi.fn().mockResolvedValue([]),
    eligible: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue(true),
    accepted: vi.fn().mockResolvedValue(true),
    failed: vi.fn().mockResolvedValue('retrying'),
    ...overrides,
  };
}

const request = (body: unknown = { message_id: message }) => new Request('https://project.supabase.co/functions/v1/support-reply-notify', {
  method: 'POST',
  headers: { Origin: origin, Authorization: 'Bearer session', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('support reply notification', () => {
  it('keeps Resend unavailable until the explicit vendor-approval switch is true', () => {
    const entry = readFileSync(join(process.cwd(), '../supabase/functions/support-reply-notify/index.ts'), 'utf8');
    expect(entry).toMatch(/SUPPORT_NOTIFY_VENDOR_APPROVED'\) === 'true'/);
    expect(entry).toMatch(/SUPPORT_NOTIFY_ACTIVATED_AT/);
    expect(entry).toMatch(/want_not_before: supportActivatedAt/);
    expect(entry).toMatch(/resendKey: supportVendorApproved && supportActivatedAt && resendKey && supportSender \? resendKey : undefined/);
  });
  it('sends a generic, idempotent hint without the reply body', async () => {
    const d = deps();
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(200);
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'student@example.test',
      idempotencyKey: 'support-message-1',
      subject: '[Semester] Support replied to SUP-123E-4567-E89B-42D3',
    }));
    const text = vi.mocked(d.send).mock.calls[0][0].text;
    expect(text).toContain('/semester/');
    expect(text).not.toContain('agent');
    expect(d.eligible).toHaveBeenCalledWith('message-1', claim);
    expect(d.accepted).toHaveBeenCalledWith('message-1', claim);
  });

  it('drains durable pending notices for the authenticated scheduler', async () => {
    const d = deps({
      cronSecret: 'cron-secret',
      pending: vi.fn().mockResolvedValue([{ messageId: 'message-2', ticketId: ticket, claimId: claim, email: 'student@example.test', attempts: 1 }]),
    });
    const cron = new Request(request().url, { method: 'POST', headers: { Authorization: 'Bearer cron-secret' }, body: '{}' });
    const response = await handleSupportNotice(cron, d);
    expect(response.status).toBe(200);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.accepted).toHaveBeenCalledWith('message-2', claim);
  });

  it('leaves rejected notices in the outbox with a retry attempt', async () => {
    const d = deps({ send: vi.fn().mockResolvedValue(false) });
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(502);
    expect(d.failed).toHaveBeenCalledWith('message-1', claim, 0, 'provider rejected notice');
    expect(d.accepted).not.toHaveBeenCalled();
  });

  it('records a transport failure and continues draining the scheduler batch', async () => {
    const d = deps({
      cronSecret: 'cron-secret',
      pending: vi.fn().mockResolvedValue([
        { messageId: 'message-1', ticketId: ticket, claimId: claim, email: 'first@example.test', attempts: 2 },
        { messageId: 'message-2', ticketId: ticket, claimId: claim, email: 'second@example.test', attempts: 0 },
      ]),
      send: vi.fn().mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(true),
    });
    const cron = new Request(request().url, { method: 'POST', headers: { Authorization: 'Bearer cron-secret' }, body: '{}' });
    const response = await handleSupportNotice(cron, d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 2, accepted: 1, retrying: 1, dead_lettered: 0, cancelled: 0 });
    expect(d.failed).toHaveBeenCalledWith('message-1', claim, 2, 'provider transport unavailable');
    expect(d.accepted).toHaveBeenCalledWith('message-2', claim);
  });

  it('fails the scheduled batch visibly when a notice is dead-lettered', async () => {
    const d = deps({
      cronSecret: 'cron-secret',
      pending: vi.fn().mockResolvedValue([{ messageId: 'message-8', ticketId: ticket, claimId: claim, email: 'student@example.test', attempts: 7 }]),
      send: vi.fn().mockResolvedValue(false),
      failed: vi.fn().mockResolvedValue('dead_lettered'),
    });
    const cron = new Request(request().url, { method: 'POST', headers: { Authorization: 'Bearer cron-secret' }, body: '{}' });
    const response = await handleSupportNotice(cron, d);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ processed: 1, accepted: 0, retrying: 0, dead_lettered: 1, cancelled: 0 });
    expect(d.failed).toHaveBeenCalledWith('message-8', claim, 7, 'provider rejected notice');
  });

  it('reports recipient-resolution retries and dead letters without calling the provider', async () => {
    const d = deps({
      cronSecret: 'cron-secret',
      pending: vi.fn().mockResolvedValue([
        { messageId: 'message-7', ticketId: ticket, claimId: claim, email: '', attempts: 6, resolutionOutcome: 'retrying' },
        { messageId: 'message-8', ticketId: ticket, claimId: claim, email: '', attempts: 7, resolutionOutcome: 'dead_lettered' },
      ]),
    });
    const cron = new Request(request().url, { method: 'POST', headers: { Authorization: 'Bearer cron-secret' }, body: '{}' });
    const response = await handleSupportNotice(cron, d);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ processed: 2, accepted: 0, retrying: 1, dead_lettered: 1, cancelled: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('counts notices cancelled after a student opts out without calling the provider', async () => {
    const d = deps({
      cronSecret: 'cron-secret',
      pending: vi.fn().mockResolvedValue([
        { messageId: 'message-3', ticketId: ticket, claimId: claim, email: '', attempts: 0, resolutionOutcome: 'cancelled' },
      ]),
    });
    const cron = new Request(request().url, { method: 'POST', headers: { Authorization: 'Bearer cron-secret' }, body: '{}' });
    const response = await handleSupportNotice(cron, d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 1, accepted: 0, retrying: 0, dead_lettered: 0, cancelled: 1 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('rechecks ownership of a claimed row before provider I/O', async () => {
    const d = deps({ eligible: vi.fn().mockResolvedValue(false) });
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(409);
    expect(d.eligible).toHaveBeenCalledWith('message-1', claim);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.accepted).not.toHaveBeenCalled();
  });

  it('reports an already-claimed notice as in progress rather than cancelled', async () => {
    const d = deps({
      notice: vi.fn().mockResolvedValue(null),
      unavailable: vi.fn().mockResolvedValue('in_progress'),
    });
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, outcome: 'in_progress' });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('uses 409 only when the notice really was cancelled', async () => {
    const d = deps({ notice: vi.fn().mockResolvedValue(null) });
    const response = await handleSupportNotice(request(), d);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ outcome: 'cancelled' });
    expect(d.unavailable).toHaveBeenCalledWith(message);
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

  it('keeps the production app allowed when no extra origin is configured', async () => {
    const response = await handleSupportNotice(request(), deps({ allowedOrigin: undefined }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  it('allows a loopback development origin only when the development switch is explicit', async () => {
    const local = new Request(request().url, {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: message }),
    });
    expect((await handleSupportNotice(local, deps({ allowedOrigin: undefined }))).status).toBe(403);
    const response = await handleSupportNotice(local, deps({ allowedOrigin: undefined, devOrigin: '1' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });
});
