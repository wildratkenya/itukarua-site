import { SITE_URL } from './newsletter';

export type BillingPreviewStatus = 'expired' | 'due' | 'ok';

export function billingStatus(billingEnd: string | null | undefined): BillingPreviewStatus {
  if (!billingEnd) return 'ok';
  const end = new Date(billingEnd).getTime();
  if (end < Date.now()) return 'expired';
  if (end - Date.now() <= 7 * 24 * 60 * 60 * 1000) return 'due';
  return 'ok';
}

export function billingAccountRef(itemId: string): string {
  return `ADV-${String(itemId).slice(0, 8).toUpperCase()}`;
}

export function billingNote(billingEnd: string | null | undefined): string {
  return billingStatus(billingEnd) === 'expired'
    ? 'Your advert has expired. Renew it now to keep it visible to customers.'
    : 'Your advert is due for renewal. Pay below to keep it running without interruption.';
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dueLabel(billingEnd: string | null | undefined): string {
  if (!billingEnd) return '—';
  return new Date(billingEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface BillingInvoiceOpts {
  business_name: string;
  item_type: 'advert' | 'service_ad';
  billing_cycle?: string | null;
  billing_end?: string | null;
  amount: number;
  accountRef: string;
  note: string;
}

export function buildBillingInvoiceHtml(opts: BillingInvoiceOpts): string {
  const label = opts.item_type === 'service_ad' ? 'Business Advert' : 'Banner Advert';
  const eBusiness = esc(opts.business_name || 'Your advert');
  const eCycle = esc(opts.billing_cycle || '7 days');
  const eNote = esc(opts.note);
  const amt = Number(opts.amount) || 0;
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Itukarua Billing — ${label}</h1>
    <p style="color:#d1fae5;font-size:12px;margin:6px 0 0">Invoice & Renewal Notice</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi ${eBusiness},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">${eNote}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600;width:160px">Advert</td><td style="padding:10px 12px">${eBusiness}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Billing Cycle</td><td style="padding:10px 12px">${eCycle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Due Date</td><td style="padding:10px 12px">${dueLabel(opts.billing_end)}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Amount Due</td><td style="padding:10px 12px;font-size:18px;font-weight:700;color:#059669">KES ${amt.toLocaleString()}</td></tr>
    </table>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="font-weight:700;color:#111827;margin:0 0 10px">How to Pay via M-Pesa</p>
      <ol style="margin:0;padding-left:20px;color:#374151;line-height:1.9;font-size:14px">
        <li>Go to <strong>M-Pesa</strong> on your phone</li>
        <li>Select <strong>Lipa na M-Pesa</strong></li>
        <li>Choose <strong>Buy Goods and Services</strong> (Till)</li>
        <li>Enter Till No: <strong>1600149</strong></li>
        <li>Amount: <strong>KES ${amt.toLocaleString()}</strong></li>
      </ol>
      <p style="color:#6b7280;font-size:12px;margin:10px 0 0">Once your payment is confirmed your advert continues without interruption.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0">Questions? Reply to this email or contact us at <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none">Itukarua Contact</a>.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildBillingInvoiceText(opts: BillingInvoiceOpts): string {
  const label = opts.item_type === 'service_ad' ? 'Business Advert' : 'Banner Advert';
  const amt = Number(opts.amount) || 0;
  return `Itukarua ${label} — Invoice & Renewal Notice

Hi ${opts.business_name || 'there'},

${opts.note}

Advert: ${opts.business_name || '—'}
Billing Cycle: ${opts.billing_cycle || '7 days'}
Due Date: ${dueLabel(opts.billing_end)}
Amount Due: KES ${amt.toLocaleString()}

How to Pay via M-Pesa:
1. Go to M-Pesa on your phone
2. Select Lipa na M-Pesa
3. Choose Buy Goods and Services (Till)
4. Enter Till No: 1600149
5. Amount: KES ${amt.toLocaleString()}

Questions? Contact us at ${SITE_URL}/contact
— Itukarua Classifieds`;
}
