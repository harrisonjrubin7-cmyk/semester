/**
 * The company site's forms: one endpoint, every route in `cta_routes`.
 *
 *     POST https://<project-ref>.supabase.co/functions/v1/lead-intake
 *
 * Everything this function decides is in `../_shared/leadintake.ts` (the
 * contract is written out at the top of that file), which
 * `app/src/lib/billing/leadintake.test.ts` drives branch by branch. This file
 * only wires in the service-key client that calls `submit_site_lead`, and the
 * owner's notification through Resend.
 *
 * `verify_jwt` is off (supabase/config.toml): the site's visitors have no
 * Semester account. The site's own origins are built in (`SITE_PRODUCTION_ORIGINS`
 * in the shared file); `SITE_ORIGINS` only adds to them. Email goes out only
 * when both `RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL` are set; the address is
 * configuration, never code. See `docs/COMMERCIAL-CORE.md`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleLeadIntake, notificationEmail, type SubmitRow } from '../_shared/leadintake.ts';

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, { auth: { persistSession: false } });

const resendKey = Deno.env.get('RESEND_API_KEY');
const notifyTo = Deno.env.get('LEAD_NOTIFY_EMAIL');
const notifyFrom = Deno.env.get('LEAD_NOTIFY_FROM') ?? 'Semester <onboarding@resend.dev>';

Deno.serve((req) =>
  handleLeadIntake(req, {
    siteOrigins: Deno.env.get('SITE_ORIGINS'),
    // A dedicated salt if one is set; otherwise the service key, which is
    // already secret and already on the function. Either way the address is
    // hashed with a key nobody outside the project holds.
    ipSalt: Deno.env.get('LEAD_IP_SALT') || serviceKey || undefined,
    async submit(lead, committeeRole, ipHash) {
      const { data, error } = await db.rpc('submit_site_lead', {
        want_route: lead.route, want_name: lead.name, want_email: lead.email,
        want_organization: lead.organization, want_role: lead.role, want_committee_role: committeeRole,
        want_message: lead.message, want_fields: lead.fields, want_page: lead.page, want_ip_hash: ipHash,
      });
      if (error) throw new Error('submit_site_lead failed');
      const row = ((data ?? []) as SubmitRow[])[0];
      if (!row) throw new Error('submit_site_lead returned nothing');
      return row;
    },
    notify: resendKey && notifyTo
      ? async (lead, row) => {
          const { subject, text } = notificationEmail(lead, row);
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: notifyFrom, to: [notifyTo], reply_to: lead.email, subject, text }),
          });
          if (!res.ok) throw new Error('resend refused');
        }
      : undefined,
  }),
);
