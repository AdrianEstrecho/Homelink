import nodemailer from 'nodemailer';

// Gmail SMTP requires the authenticated account itself (App Passwords don't work with the
// regular account password — Google requires one generated under Account > Security >
// 2-Step Verification > App Passwords). NOTE: this is raw SMTP, which several hosts
// (Render's free tier included) block outbound for — if this is deployed there, email
// delivery will silently fail in production even though it works locally.
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_APP_PASSWORD;

const transporter = (SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// Gmail rejects/rewrites a From address that isn't the authenticated account (or a verified
// alias of it), so this defaults to the SMTP account itself rather than a generic address.
const FROM = process.env.EMAIL_FROM || `HomeLink <${SMTP_USER}>`;

export async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { mock: true };
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
  return { sent: true };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const money = (n) => `₱${Number(n).toLocaleString('en-PH')}`;
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// Shared header/footer every transactional email renders inside — keeps the two-tone
// "HomeLink" wordmark, company address, and layout consistent across every template
// instead of each one repeating (and slowly drifting from) its own copy of the shell.
function emailShell(bodyHtml) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#14181f">
      <div style="background:#0f2b5b;padding:28px 24px;text-align:center">
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em">
          <span style="color:#ffffff">Home</span><span style="color:#ff6b35">Link</span>
        </div>
        <p style="margin:6px 0 0;color:#c7d2e8;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Home Improvement &amp; Services</p>
      </div>
      <div style="padding:28px 24px">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #eef0f3;text-align:center">
        <p style="margin:0;font-size:11px;color:#9ca3af">${process.env.COMPANY_ADDRESS || 'HomeLink'}</p>
        <p style="margin:6px 0 0;font-size:11px;color:#c1c5cc">You're receiving this email because of activity on your HomeLink account.</p>
      </div>
    </div>`;
}

function codeBlock(code) {
  return `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px">${code}</p>`;
}

function ctaButton(label, href) {
  return `<p style="margin-top:20px"><a href="${href}" style="display:inline-block;background:#ff6b35;color:#ffffff;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">${label}</a></p>`;
}

const ORDER_STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'Pending', message: 'Your order is pending processing.' },
  processing: { bg: '#dbeafe', fg: '#1e40af', label: 'Processing', message: 'Your order is being prepared.' },
  shipped: { bg: '#ede9fe', fg: '#5b21b6', label: 'Shipped', message: "Your order is on its way!" },
  delivered: { bg: '#dcfce7', fg: '#166534', label: 'Delivered', message: 'Your order has been delivered. Enjoy!' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b', label: 'Cancelled', message: 'Your order has been cancelled.' },
};

const BOOKING_STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'Pending' },
  confirmed: { bg: '#dbeafe', fg: '#1e40af', label: 'Confirmed' },
  in_progress: { bg: '#ede9fe', fg: '#5b21b6', label: 'In Progress' },
  completed: { bg: '#dcfce7', fg: '#166534', label: 'Completed' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b', label: 'Cancelled' },
};

function statusBadge(meta) {
  return `<span style="display:inline-block;background:${meta.bg};color:${meta.fg};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em">${meta.label}</span>`;
}

export function orderConfirmationEmail(order, items, user) {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.name} <span style="color:#9ca3af">× ${i.quantity}</span></td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${money(i.price)}</td>
    </tr>`).join('');
  const discountRow = order.discount > 0 ? `
    <tr>
      <td style="padding:8px;color:#16a34a">Discount${order.promo_code ? ` (${order.promo_code})` : ''}</td>
      <td style="padding:8px;text-align:right;color:#16a34a">-${money(order.discount)}</td>
    </tr>` : '';

  return sendEmail({
    to: user.email,
    subject: `HomeLink Order Confirmation #${order.id.slice(0, 8).toUpperCase()}`,
    html: emailShell(`
      <h2 style="margin-top:0">Order Confirmed!</h2>
      <p>Hi ${user.first_name}, thank you for your order. This email is your official receipt — keep it for your records.</p>
      <p style="color:#4b5563">
        <strong>Order ID:</strong> ${order.id.slice(0, 8).toUpperCase()}<br>
        <strong>Placed:</strong> ${new Date(order.created_at || Date.now()).toLocaleString('en-PH')}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:right">Amount</th></tr>
        ${itemRows}
        <tr><td style="padding:8px">Subtotal</td><td style="padding:8px;text-align:right">${money(order.subtotal)}</td></tr>
        ${discountRow}
        <tr>
          <td style="padding:8px;font-weight:bold;border-top:2px solid #0f2b5b">Total</td>
          <td style="padding:8px;text-align:right;font-weight:bold;border-top:2px solid #0f2b5b">${money(order.total)}</td>
        </tr>
      </table>
      ${order.shipping_address ? `<p><strong>Shipping to:</strong> ${order.shipping_address}</p>` : ''}
      ${order.payment_method ? `<p><strong>Payment method:</strong> ${capitalize(order.payment_method)}</p>` : ''}
      ${ctaButton('View your order', `${frontendUrl()}/orders`)}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Questions about this order? Reply to this email or reach us from your HomeLink account.</p>
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
      <h2 style="margin-top:0">Order update</h2>
      <p>Hi ${user.first_name}, ${meta.message}</p>
      <div style="margin:16px 0">${statusBadge(meta)}</div>
      <p style="color:#4b5563">
        <strong>Order ID:</strong> ${order.id.slice(0, 8).toUpperCase()}<br>
        <strong>Total:</strong> ${money(order.total)}
      </p>
      ${ctaButton('View your order', `${frontendUrl()}/orders`)}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Questions about this order? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}

export function passwordResetEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Your HomeLink password reset code',
    html: emailShell(`
      <h2 style="margin-top:0">Reset your password</h2>
      <p>Hi ${user.first_name}, we received a request to reset your password. Enter this code to continue. It expires in 15 minutes.</p>
      ${codeBlock(code)}
      <p>If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export function signupVerificationEmail(email, code) {
  return sendEmail({
    to: email,
    subject: 'Verify your email for HomeLink',
    html: emailShell(`
      <h2 style="margin-top:0">Confirm your email</h2>
      <p>Enter this code to verify your email and finish creating your HomeLink account. It expires in 15 minutes.</p>
      ${codeBlock(code)}
      <p>If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export function twoFactorCodeEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Your HomeLink sign-in code',
    html: emailShell(`
      <h2 style="margin-top:0">Confirm it's you</h2>
      <p>Hi ${user.first_name}, enter this code to finish signing in to HomeLink. It expires in 10 minutes.</p>
      ${codeBlock(code)}
      <p>If you didn't try to sign in, you should change your password right away.</p>
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
      <h2 style="margin-top:0">Turn on two-factor authentication</h2>
      <p>Hi ${user.first_name}, enter this code to confirm turning on two-factor authentication for your HomeLink account. It expires in 10 minutes.</p>
      ${codeBlock(code)}
      <p>If you didn't request this, you can safely ignore this email — your account stays as it is.</p>
    `),
  });
}

export function bookingConfirmationEmail(booking, service, user) {
  return sendEmail({
    to: user.email,
    subject: 'HomeLink Service Booking Received',
    html: emailShell(`
      <h2 style="margin-top:0">Service Booked!</h2>
      <p>Hi ${user.first_name}, your service request has been received. We'll email you again as soon as it's confirmed with an assigned technician.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">Service</td><td style="padding:6px 0;font-weight:600">${service.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Date &amp; Time</td><td style="padding:6px 0;font-weight:600">${booking.scheduled_date} at ${booking.scheduled_time}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Address</td><td style="padding:6px 0;font-weight:600">${booking.address}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Total</td><td style="padding:6px 0;font-weight:600">${money(booking.price)}</td></tr>
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
    ? `<tr><td style="padding:6px 0;color:#6b7280">Technician</td><td style="padding:6px 0;font-weight:600">${technician.first_name} ${technician.last_name}${technician.phone ? ` · ${technician.phone}` : ''}</td></tr>`
    : '';
  return sendEmail({
    to: user.email,
    subject: `Your ${service.name} booking is confirmed`,
    html: emailShell(`
      <h2 style="margin-top:0">Booking confirmed!</h2>
      <p>Hi ${user.first_name}, your service appointment is confirmed. Here are the complete details:</p>
      <div style="margin:16px 0">${statusBadge(meta)}</div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">Service</td><td style="padding:6px 0;font-weight:600">${service.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Date &amp; Time</td><td style="padding:6px 0;font-weight:600">${booking.scheduled_date} at ${booking.scheduled_time}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Address</td><td style="padding:6px 0;font-weight:600">${booking.address}</td></tr>
        ${technicianRow}
        <tr><td style="padding:6px 0;color:#6b7280">Total</td><td style="padding:6px 0;font-weight:600">${money(booking.price)}</td></tr>
      </table>
      ${ctaButton('View your booking', `${frontendUrl()}/bookings`)}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Questions about this booking? Reply to this email or reach us from your HomeLink account.</p>
    `),
  });
}
