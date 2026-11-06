/** Display helpers shared by public components and the admin. */
export function formatPrice(p: { price_amount: number | null; price_label: string | null }) {
  if (p.price_label) return p.price_label;
  if (p.price_amount == null) return 'Price on request';
  const n = Number(p.price_amount);
  if (n >= 1e7) return `₹ ${(n / 1e7).toFixed(n % 1e7 ? 2 : 0)} Cr`;
  if (n >= 1e5) return `₹ ${(n / 1e5).toFixed(n % 1e5 ? 2 : 0)} Lakh`;
  return `₹ ${new Intl.NumberFormat('en-IN').format(n)}`;
}
/** Business time zone for displaying timestamps (dates without a time stay in UTC so calendar dates never shift). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const formatDate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Intl.DateTimeFormat('en-IN', { timeZone: opts.hour ? APP_TIMEZONE : 'UTC', ...opts }).format(new Date(d)) : '';
export const AREA_UNIT: Record<string, string> = { sqft: 'sq.ft', sqm: 'm²', acre: 'acres', sqyd: 'sq.yd' };
