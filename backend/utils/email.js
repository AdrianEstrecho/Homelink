// Raw SMTP (the original approach) is blocked outbound on Render regardless of plan, which
// silently broke delivery in production while working fine locally. SendGrid's HTTP API was
// tried next, but its free tier is a 60-day trial rather than a permanent plan. Brevo was
// tried after that, but its signup asked for card/phone verification in practice. Resend's
// signup needs neither — no domain, no card, no phone — but until a domain is verified in
// the Resend dashboard, it only sends from onboarding@resend.dev and only to the address the
// account was signed up with (an anti-abuse sandbox limit, not a config bug). Runs over
// normal HTTPS, so unlike SMTP it isn't blocked on hosts (Render included) that block
// outbound SMTP ports.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Brevo takes priority when its key is set. Unlike Resend's sandbox, it needs no domain to reach
// arbitrary recipients — only a sender address verified under Senders & IPs in the Brevo
// dashboard, which EMAIL_FROM must then use. Also HTTPS, so Render's SMTP block doesn't apply.
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Until a domain is verified (see comment above), this must be "<Name> <onboarding@resend.dev>"
// for Resend; for Brevo, "<Name> <your-verified-sender@example.com>".
const FROM = process.env.EMAIL_FROM;

// Brevo wants the sender as { name, email } rather than the "Name <email>" string Resend takes.
function parseFrom(from) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || '');
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from };
}

async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ sender: parseFrom(FROM), to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) {
    throw new Error(`Brevo send failed (${res.status}): ${await res.text()}`);
  }
  return { sent: true };
}

export async function sendEmail({ to, subject, html }) {
  if (BREVO_API_KEY) return sendViaBrevo({ to, subject, html });
  if (!RESEND_API_KEY) {
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { mock: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
  }
  return { sent: true };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const money = (n) => `₱${Number(n).toLocaleString('en-PH')}`;
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const MONO = "'Courier New',Courier,monospace";

// Shared header/footer every transactional email renders inside — a dashed-bordered "slip" on
// a tinted page, echoing a printed receipt, with the same two-tone HomeLink wordmark and
// company address every template used to repeat (and slowly drift from) on its own.
function emailShell(bodyHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px dashed #b8bfc9;font-family:Arial,Helvetica,sans-serif;color:#14181f">
          <tr><td style="padding:26px 28px 18px;text-align:center;border-bottom:1px dashed #c7cad1">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em">
              <span style="color:#0f2b5b">Home</span><span style="color:#ff6b35">Link</span>
            </div>
            <p style="margin:6px 0 0;font-family:${MONO};color:#9ca3af;font-size:10px;letter-spacing:.14em;text-transform:uppercase">Home Improvement &amp; Services</p>
          </td></tr>
          <tr><td style="padding:26px 28px">
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px dashed #c7cad1;text-align:center">
            <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:.04em;color:#9ca3af">${process.env.COMPANY_ADDRESS || 'HomeLink'}</p>
            <p style="margin:8px 0 0;font-size:10px;color:#c1c5cc">You're receiving this email because of activity on your HomeLink account.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function codeBlock(code) {
  return `<p style="font-family:${MONO};font-size:30px;font-weight:bold;letter-spacing:8px;background:#fafbfc;border:1px dashed #c7cad1;padding:18px;text-align:center;color:#0f2b5b">${code}</p>`;
}

function ctaButton(label, href) {
  return `<p style="margin:22px 0 0;text-align:center"><a href="${href}" style="display:inline-block;background:#ff6b35;color:#ffffff;font-weight:700;padding:11px 26px;border-radius:4px;text-decoration:none;font-family:${MONO};letter-spacing:.04em;text-transform:uppercase;font-size:12px">${label}</a></p>`;
}

// Centered "ORDER #.../BOOKING #..." block framed in dashed rules, standing in for the
// header a printed receipt stamps right under the store name.
function receiptMeta(line1, line2) {
  return `
    <div style="border-top:1px dashed #c7cad1;border-bottom:1px dashed #c7cad1;padding:12px 0;margin:14px 0 4px;text-align:center;font-family:${MONO}">
      <div style="font-size:14px;font-weight:700;color:#0f2b5b;letter-spacing:.02em">${line1}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:3px">${line2}</div>
    </div>`;
}

function sectionLabel(text) {
  return `<p style="margin:18px 0 8px;text-align:center;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.16em;color:#9ca3af">${text}</p>`;
}

// One label/value row in a receipt-style details table — dashed rule between rows, a bold
// double rule instead when it's the closing total line.
function detailRow(label, value, isTotal = false) {
  const border = isTotal ? 'border-top:4px double #0f2b5b' : 'border-bottom:1px dashed #dfe3e8';
  const valueStyle = isTotal ? 'font-weight:bold;font-size:14px;color:#0f2b5b' : 'font-size:12px;color:#14181f';
  return `
    <tr>
      <td style="padding:7px 0;${border};font-family:${MONO};font-size:11px;color:#9ca3af;width:120px;vertical-align:top">${label}</td>
      <td style="padding:7px 0;${border};font-family:${MONO};${valueStyle};text-align:right">${value}</td>
    </tr>`;
}

const ORDER_STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'Pending', message: 'Your order is pending processing.' },
  processing: { bg: '#dbeafe', fg: '#1e40af', label: 'Processing', message: 'Your order is being prepared.' },
  shipped: { bg: '#ede9fe', fg: '#5b21b6', label: 'Shipped', message: "Your order is on its way!" },
  delivered: { bg: '#dcfce7', fg: '#166534', label: 'Delivered', message: 'Your order has been delivered. Enjoy!' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b', label: 'Cancelled', message: 'Your order has been cancelled.' },
};

const BOOKING_STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'Pending', message: 'Your service request is pending confirmation.' },
  confirmed: { bg: '#dbeafe', fg: '#1e40af', label: 'Confirmed', message: 'Your service appointment is confirmed.' },
  in_progress: { bg: '#ede9fe', fg: '#5b21b6', label: 'In Progress', message: 'Your technician has started work on your service.' },
  completed: { bg: '#dcfce7', fg: '#166534', label: 'Completed', message: 'Your service has been completed. Thank you for choosing HomeLink!' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b', label: 'Cancelled', message: 'Your service booking has been cancelled.' },
};

function statusBadge(meta) {
  return `<span style="display:inline-block;background:${meta.bg};color:${meta.fg};font-family:${MONO};font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em">${meta.label}</span>`;
}

export function orderConfirmationEmail(order, items, user) {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:7px 0;border-bottom:1px dashed #dfe3e8;font-family:${MONO};font-size:12px;color:#14181f;vertical-align:top">
        ${i.name}<br><span style="color:#9ca3af;font-size:11px">Qty ${i.quantity}</span>
      </td>
      <td style="padding:7px 0;border-bottom:1px dashed #dfe3e8;text-align:right;vertical-align:top;font-family:${MONO};font-size:12px;font-weight:600">${money(i.price)}</td>
    </tr>`).join('');
  const discountRow = order.discount > 0 ? `
    <tr>
      <td style="padding:6px 0;font-family:${MONO};font-size:12px;color:#16a34a">Discount${order.promo_code ? ` (${order.promo_code})` : ''}</td>
      <td style="padding:6px 0;text-align:right;font-family:${MONO};font-size:12px;color:#16a34a">-${money(order.discount)}</td>
    </tr>` : '';

  return sendEmail({
    to: user.email,
    subject: `HomeLink Order Confirmation #${order.id.slice(0, 8).toUpperCase()}`,
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Order Confirmed!</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, thank you for your order.<br>This email is your official receipt — keep it for your records.</p>
      ${receiptMeta(`ORDER #${order.id.slice(0, 8).toUpperCase()}`, new Date(order.created_at || Date.now()).toLocaleString('en-PH'))}
      ${sectionLabel('ITEMS')}
      <table style="width:100%;border-collapse:collapse">${itemRows}</table>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr>
          <td style="padding:6px 0;font-family:${MONO};font-size:12px;color:#4b5563">Subtotal</td>
          <td style="padding:6px 0;text-align:right;font-family:${MONO};font-size:12px;color:#4b5563">${money(order.subtotal)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td style="padding:10px 0 0;border-top:4px double #0f2b5b;font-weight:bold;font-family:${MONO};font-size:15px;color:#0f2b5b">TOTAL</td>
          <td style="padding:10px 0 0;border-top:4px double #0f2b5b;text-align:right;font-weight:bold;font-family:${MONO};font-size:15px;color:#ff6b35">${money(order.total)}</td>
        </tr>
      </table>
      ${order.shipping_address ? `<p style="margin:16px 0 0;font-family:${MONO};font-size:12px"><strong>Shipping to:</strong> ${order.shipping_address}</p>` : ''}
      ${order.payment_method ? `<p style="margin:6px 0 0;font-family:${MONO};font-size:12px"><strong>Payment method:</strong> ${capitalize(order.payment_method)}</p>` : ''}
      ${ctaButton('View your order', `${frontendUrl()}/orders`)}
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">Questions about this order? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}

// Sent whenever staff move an order to a new status (processing/shipped/delivered/cancelled)
// so the customer hears about fulfillment progress without having to check the site.
export function orderStatusEmail(order, user, status) {
  const meta = ORDER_STATUS_META[status] || { bg: '#f3f4f6', fg: '#374151', label: capitalize(status), message: `Your order status was updated to ${capitalize(status)}.` };
  return sendEmail({
    to: user.email,
    subject: `Order #${order.id.slice(0, 8).toUpperCase()} is now ${meta.label}`,
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Order Update</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, ${meta.message}</p>
      <div style="text-align:center;margin:14px 0">${statusBadge(meta)}</div>
      ${receiptMeta(`ORDER #${order.id.slice(0, 8).toUpperCase()}`, `Total: ${money(order.total)}`)}
      ${ctaButton('View your order', `${frontendUrl()}/orders`)}
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">Questions about this order? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}

export function passwordResetEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Your HomeLink password reset code',
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Reset Your Password</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, we received a request to reset your password. Enter this code to continue. It expires in 15 minutes.</p>
      ${codeBlock(code)}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export function signupVerificationEmail(email, code) {
  return sendEmail({
    to: email,
    subject: 'Verify your email for HomeLink',
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Confirm Your Email</h2>
      <p style="text-align:center;color:#4b5563">Enter this code to verify your email and finish creating your HomeLink account. It expires in 15 minutes.</p>
      ${codeBlock(code)}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export function twoFactorCodeEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Your HomeLink sign-in code',
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Confirm It's You</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, enter this code to finish signing in to HomeLink. It expires in 10 minutes.</p>
      ${codeBlock(code)}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">If you didn't try to sign in, you should change your password right away.</p>
    `),
  });
}

// Sent from Account > Security when a user turns two-factor authentication on — distinct
// from twoFactorCodeEmail (sent at login) since the context/copy differs.
export function twoFactorSetupEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Confirm two-factor authentication for HomeLink',
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Turn On Two-Factor Authentication</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, enter this code to confirm turning on two-factor authentication for your HomeLink account. It expires in 10 minutes.</p>
      ${codeBlock(code)}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">If you didn't request this, you can safely ignore this email — your account stays as it is.</p>
    `),
  });
}

export function bookingConfirmationEmail(booking, service, user) {
  return sendEmail({
    to: user.email,
    subject: 'HomeLink Service Booking Received',
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Service Booked!</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, your service request has been received.<br>We'll email you again as soon as it's confirmed with an assigned technician.</p>
      ${sectionLabel('BOOKING DETAILS')}
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Service', service.name)}
        ${detailRow('Date &amp; Time', `${booking.scheduled_date} at ${booking.scheduled_time}`)}
        ${detailRow('Address', booking.address)}
        ${detailRow('Total', money(booking.price), true)}
      </table>
      ${ctaButton('View your booking', `${frontendUrl()}/bookings`)}
    `),
  });
}

// Sent once a booking's status actually transitions to 'confirmed' — typically the moment a
// technician is assigned — with the complete appointment details the customer needs.
export function bookingConfirmedEmail(booking, service, technician, user) {
  const meta = BOOKING_STATUS_META.confirmed;
  const technicianRow = technician
    ? detailRow('Technician', `${technician.first_name} ${technician.last_name}${technician.phone ? ` · ${technician.phone}` : ''}`)
    : '';
  return sendEmail({
    to: user.email,
    subject: `Your ${service.name} booking is confirmed`,
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Booking Confirmed!</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, your service appointment is confirmed. Here are the complete details:</p>
      <div style="text-align:center;margin:14px 0">${statusBadge(meta)}</div>
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Service', service.name)}
        ${detailRow('Date &amp; Time', `${booking.scheduled_date} at ${booking.scheduled_time}`)}
        ${detailRow('Address', booking.address)}
        ${technicianRow}
        ${detailRow('Total', money(booking.price), true)}
      </table>
      ${ctaButton('View your booking', `${frontendUrl()}/bookings`)}
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">Questions about this booking? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}

// Sent whenever a booking moves to a status other than 'confirmed' (in_progress/completed/
// cancelled) — the booking counterpart to orderStatusEmail. 'confirmed' keeps its own richer
// bookingConfirmedEmail above, since that one also includes the assigned technician.
export function bookingStatusEmail(booking, service, user, status) {
  const meta = BOOKING_STATUS_META[status] || { bg: '#f3f4f6', fg: '#374151', label: capitalize(status), message: `Your booking status was updated to ${capitalize(status)}.` };
  return sendEmail({
    to: user.email,
    subject: `Your ${service.name} booking is now ${meta.label}`,
    html: emailShell(`
      <h2 style="margin:0 0 6px;text-align:center">Booking Update</h2>
      <p style="text-align:center;color:#4b5563">Hi ${user.first_name}, ${meta.message}</p>
      <div style="text-align:center;margin:14px 0">${statusBadge(meta)}</div>
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Service', service.name)}
        ${detailRow('Date &amp; Time', `${booking.scheduled_date} at ${booking.scheduled_time}`)}
        ${detailRow('Total', money(booking.price), true)}
      </table>
      ${ctaButton('View your booking', `${frontendUrl()}/bookings`)}
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">Questions about this booking? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}
