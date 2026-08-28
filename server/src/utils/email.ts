import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;
if (resendApiKey) resend = new Resend(resendApiKey);

const FROM = "Krishi Market <noreply@krishimarket.in>";

/**
 * Base HTML wrapper for branded emails.
 */
function emailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#fbf9f4;margin:0;padding:0">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#012d1d;padding:32px 24px;text-align:center">
      <h1 style="color:#c1ecd4;font-size:24px;margin:0">🌾 Krishi Market</h1>
    </div>
    <div style="padding:32px 24px">
      <h2 style="color:#012d1d;font-size:20px;margin:0 0 16px">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid #c1c8c2">
      <p style="color:#717973;font-size:12px;margin:4px 0">Krishi Market — Direct from local farms to your table.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Safely send an email via Resend. Logs on failure but never throws.
 */
async function safeSend(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Email] RESEND_API_KEY not set — would send "${subject}" to ${to}`);
    }
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (error) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, error);
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetUrl = `${clientUrl}/auth/reset-password/${resetToken}`;
  if (!resend) {
    // In development without RESEND_API_KEY, surface the link in logs
    // so the developer can still complete the flow.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Email] RESEND_API_KEY not set — password-reset link for ${email}: ${resetUrl}`);
    }
    return;
  }
  try {
    await resend.emails.send({
      from: "Krishi Market <noreply@krishimarket.in>",
      to: email,
      subject: "Reset Your Krishi Market Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#fbf9f4;margin:0;padding:0">
          <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
            <div style="background:#012d1d;padding:32px 24px;text-align:center">
              <h1 style="color:#c1ecd4;font-size:24px;margin:0">🌾 Krishi Market</h1>
            </div>
            <div style="padding:32px 24px">
              <h2 style="color:#012d1d;font-size:20px;margin:0 0 12px">Reset your password</h2>
              <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${name},</p>
              <p style="color:#414844;font-size:15px;line-height:1.6">We received a request to reset your Krishi Market password.</p>
              <p style="text-align:center">
                <a href="${resetUrl}" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px">Reset Password</a>
              </p>
              <p style="color:#414844;font-size:15px">This link expires in <strong>1 hour</strong>.</p>
              <div style="margin-top:24px;padding:16px;background:#f5f3ee;border-radius:8px;font-size:13px;color:#717973;word-break:break-all">
                <p>Or copy this URL: ${resetUrl}</p>
              </div>
            </div>
            <div style="padding:24px;text-align:center;border-top:1px solid #c1c8c2">
              <p style="color:#717973;font-size:12px;margin:4px 0">Krishi Market — Direct from local farms to your table.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    // Email sent successfully
  } catch (error) {
    console.error(`[Email] Failed to send to ${email}:`, error);
  }
}

/* ─── Order Lifecycle Notifications ─────────────── */

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface OrderNotificationData {
  orderId: string;
  consumerName: string;
  consumerEmail: string;
  farmerName: string;
  farmerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryAddress?: string;
}

function formatOrderItems(items: OrderItem[]): string {
  return items
    .map((item) => `  <li style="padding:6px 0;color:#414844;font-size:14px">${item.name} × ${item.quantity} ${item.unit} — ₹${item.price * item.quantity}</li>`)
    .join("");
}

const ORDER_ID_PREFIX = "#KM-";

/**
 * Send order placed confirmation to consumer and notify the farmer.
 */
export async function sendOrderPlacedEmails(data: OrderNotificationData): Promise<void> {
  const shortId = ORDER_ID_PREFIX + data.orderId.slice(-5).toUpperCase();
  const itemsHtml = formatOrderItems(data.items);
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  // ── Email to Consumer ──
  const consumerHtml = emailLayout(
    "Order Confirmed! 🎉",
    `
      <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${data.consumerName},</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">Your order <strong>${shortId}</strong> has been placed successfully.</p>
      <div style="background:#f5f3ee;border-radius:12px;padding:16px;margin:16px 0">
        <p style="font-size:13px;color:#717973;margin:0 0 8px">Order Items:</p>
        <ul style="list-style:none;padding:0;margin:0">${itemsHtml}</ul>
        <p style="font-size:16px;font-weight:700;color:#012d1d;margin:12px 0 0">Total: ₹${data.totalAmount}</p>
      </div>
      <p style="color:#414844;font-size:15px;line-height:1.6">Farmer <strong>${data.farmerName}</strong> will confirm your order shortly.</p>
      <p style="text-align:center;margin:20px 0">
        <a href="${clientUrl}/orders/${data.orderId}" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">View Order</a>
      </p>
    `
  );

  // ── Email to Farmer ──
  const farmerHtml = emailLayout(
    "New Order Received! 📦",
    `
      <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${data.farmerName},</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">You have a new order <strong>${shortId}</strong> from ${data.consumerName}.</p>
      <div style="background:#f5f3ee;border-radius:12px;padding:16px;margin:16px 0">
        <p style="font-size:13px;color:#717973;margin:0 0 8px">Order Items:</p>
        <ul style="list-style:none;padding:0;margin:0">${itemsHtml}</ul>
        <p style="font-size:16px;font-weight:700;color:#012d1d;margin:12px 0 0">Total: ₹${data.totalAmount}</p>
      </div>
      <p style="color:#414844;font-size:15px;line-height:1.6">Please confirm and prepare the order.</p>
      <p style="text-align:center;margin:20px 0">
        <a href="${clientUrl}/farmer/orders/${data.orderId}" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">View Order</a>
      </p>
    `
  );

  await Promise.all([
    safeSend(data.consumerEmail, `Order ${shortId} Placed Successfully`, consumerHtml),
    safeSend(data.farmerEmail, `New Order ${shortId} Received`, farmerHtml),
  ]);
}

/**
 * Notify consumer when order status changes (confirmed, preparing, out-for-delivery, delivered, cancelled).
 */
export async function sendOrderStatusUpdateEmail(
  consumerEmail: string,
  consumerName: string,
  orderId: string,
  newStatus: string,
  farmerName: string
): Promise<void> {
  const shortId = ORDER_ID_PREFIX + orderId.slice(-5).toUpperCase();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  const statusMessages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: "Order Confirmed ✅",
      body: `<p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Great news! Farmer <strong>${farmerName}</strong> has confirmed your order <strong>${shortId}</strong>.</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Your order is now being prepared.</p>`,
    },
    preparing: {
      title: "Order Being Prepared 👨‍🍳",
      body: `<p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Your order <strong>${shortId}</strong> is being prepared by <strong>${farmerName}</strong>.</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">It will be out for delivery soon!</p>`,
    },
    "out-for-delivery": {
      title: "Order Out for Delivery 🚚",
      body: `<p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Your order <strong>${shortId}</strong> is on its way!</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Please keep your phone handy for delivery.</p>`,
    },
    delivered: {
      title: "Order Delivered! 🎉",
      body: `<p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Your order <strong>${shortId}</strong> has been delivered successfully!</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">We hope you enjoy your fresh produce. Don't forget to leave a review!</p>`,
    },
    cancelled: {
      title: "Order Cancelled ❌",
      body: `<p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">Your order <strong>${shortId}</strong> has been cancelled.</p>
        <p style="color:#414844;font-size:15px;line-height:1.6">If you have any questions, please contact our support team.</p>`,
    },
  };

  const statusInfo = statusMessages[newStatus];
  if (!statusInfo) return;

  const html = emailLayout(statusInfo.title, `
    ${statusInfo.body}
    <p style="text-align:center;margin:20px 0">
      <a href="${clientUrl}/orders/${orderId}" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">View Order</a>
    </p>
  `);

  await safeSend(consumerEmail, statusInfo.title, html);
}

/**
 * Notify consumer when their order is cancelled by the farmer.
 */
export async function sendOrderCancelledByFarmerEmail(
  consumerEmail: string,
  consumerName: string,
  orderId: string,
  farmerName: string
): Promise<void> {
  const shortId = ORDER_ID_PREFIX + orderId.slice(-5).toUpperCase();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  const html = emailLayout(
    "Order Cancelled ❌",
    `
      <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${consumerName},</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">Unfortunately, farmer <strong>${farmerName}</strong> has cancelled your order <strong>${shortId}</strong>.</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">If you were charged, a refund will be processed automatically.</p>
      <p style="text-align:center;margin:20px 0">
        <a href="${clientUrl}/orders" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">View Orders</a>
      </p>
    `
  );

  await safeSend(consumerEmail, `Order ${shortId} Cancelled by Farmer`, html);
}

/**
 * Notify farmer when consumer cancels an order.
 */
export async function sendOrderCancelledByConsumerEmail(
  farmerEmail: string,
  farmerName: string,
  orderId: string,
  consumerName: string
): Promise<void> {
  const shortId = ORDER_ID_PREFIX + orderId.slice(-5).toUpperCase();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  const html = emailLayout(
    "Order Cancelled ❌",
    `
      <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${farmerName},</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">Customer <strong>${consumerName}</strong> has cancelled order <strong>${shortId}</strong>.</p>
      <p style="color:#414844;font-size:15px;line-height:1.6">The product quantities have been restored to your inventory.</p>
      <p style="text-align:center;margin:20px 0">
        <a href="${clientUrl}/farmer/orders" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">View Orders</a>
      </p>
    `
  );

  await safeSend(farmerEmail, `Order ${shortId} Cancelled by Customer`, html);
}
