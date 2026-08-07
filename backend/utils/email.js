import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_USER
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { mock: true };
  }
  return transporter.sendMail({
    from: `"HomeLink" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function orderConfirmationEmail(order, items, user) {
  const money = (n) => `₱${Number(n).toLocaleString('en-PH')}`;
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
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f2b5b;color:white;padding:20px;text-align:center">
          <h1 style="margin:0">HomeLink</h1>
          <p style="margin:5px 0 0">Your Home Improvement Partner</p>
        </div>
        <div style="padding:20px">
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
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Questions about this order? Reply to this email or reach us from your HomeLink account.</p>
        </div>
      </div>`,
  });
}

export function passwordResetEmail(user, code) {
  return sendEmail({
    to: user.email,
    subject: 'Your HomeLink password reset code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f2b5b;color:white;padding:20px;text-align:center">
          <h1 style="margin:0">HomeLink</h1>
        </div>
        <div style="padding:20px">
          <h2>Reset your password</h2>
          <p>Hi ${user.first_name}, we received a request to reset your password. Enter this code to continue. It expires in 15 minutes.</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px">${code}</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
}

export function bookingConfirmationEmail(booking, service, user) {
  return sendEmail({
    to: user.email,
    subject: `HomeLink Service Booking Confirmed`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f2b5b;color:white;padding:20px;text-align:center">
          <h1 style="margin:0">HomeLink</h1>
        </div>
        <div style="padding:20px">
          <h2>Service Booked!</h2>
          <p>Hi ${user.first_name}, your service has been scheduled.</p>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${booking.scheduled_date} at ${booking.scheduled_time}</p>
          <p><strong>Address:</strong> ${booking.address}</p>
          <p><strong>Total:</strong> ₱${booking.price.toLocaleString()}</p>
        </div>
      </div>`,
  });
}
