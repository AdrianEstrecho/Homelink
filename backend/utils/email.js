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

export function orderConfirmationEmail(order, items, user) {
  const itemRows = items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>₱${i.price.toLocaleString()}</td></tr>`).join('');
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
          <h2>Order Confirmed!</h2>
          <p>Hi ${user.first_name}, thank you for your order.</p>
          <p><strong>Order ID:</strong> ${order.id.slice(0, 8).toUpperCase()}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Item</th><th>Qty</th><th>Price</th></tr>
            ${itemRows}
          </table>
          <p><strong>Total:</strong> ₱${order.total.toLocaleString()}</p>
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
