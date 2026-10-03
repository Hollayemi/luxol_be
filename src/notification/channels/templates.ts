
export const NOTIFICATION_TEMPLATES = {
  AUTH_WELCOME: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Welcome to Luxol Market, {{firstName}}!",
    message:
      "Hi {{firstName}}, welcome to Luxol Market. Your account is ready — start shopping fresh meat, groceries and more. Need help? Just reply to this email.",
    params: { firstName: "string" },
  },

  AUTH_EMAIL_VERIFICATION: {
    channels: ["EMAIL"],
    subject: "Verify your email address",
    message:
      "Hi {{firstName}}, please verify your email by clicking the button below. This link expires in 24 hours.",
    url: "{{verifyUrl}}",
    params: { firstName: "string", verifyUrl: "string" },
  },

  AUTH_PASSWORD_RESET: {
    channels: ["EMAIL"],
    subject: "Reset your Luxol Market password",
    message:
      "Hi {{firstName}}, someone requested a password reset for your account. If this was you, click the button below. The link expires in 1 hour. If not, ignore this email.",
    url: "{{resetUrl}}",
    params: { firstName: "string", resetUrl: "string" },
  },

  AUTH_PASSWORD_CHANGED: {
    channels: ["EMAIL", "SMS"],
    subject: "Your password was changed",
    message:
      "Hi {{firstName}}, your Luxol Market password was changed on {{changedAt}}. If this wasn't you, contact support immediately.",
    params: { firstName: "string", changedAt: "string" },
  },

  AUTH_NEW_DEVICE_LOGIN: {
    channels: ["EMAIL", "IN_APP"],
    subject: "New sign-in to your account",
    message:
      "Hi {{firstName}}, we noticed a new sign-in from {{device}} ({{ip}}). If this wasn't you, change your password immediately.",
    params: { firstName: "string", device: "string", ip: "string"},
  },

  AUTH_ACCOUNT_SUSPENDED: {
    channels: ["EMAIL"],
    subject: "Your Luxol Market account has been suspended",
    message:
      "Hi {{firstName}}, your account has been suspended. Reason: {{reason}}. Reply to this email if you think this is a mistake.",
    params: { firstName: "string", reason: "string" },
  },

  AUTH_ACCOUNT_REACTIVATED: {
    channels: ["EMAIL"],
    subject: "Your account has been reactivated",
    message:
      "Hi {{firstName}}, your Luxol Market account is active again. Welcome back!",
    params: { firstName: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // ORDERS — CUSTOMER
  // ─────────────────────────────────────────────────────────────
  ORDER_PLACED: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Order #{{orderNumber}} received",
    message:
      "Hi {{firstName}}, we've received your order #{{orderNumber}} for ₦{{total}}. We'll notify you once it's confirmed and on the way.",
    url: "{{orderUrl}}",
    params: { firstName: "string", orderNumber: "string", total: "number", orderUrl: "string" },
  },

  ORDER_PAYMENT_CONFIRMED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Payment confirmed for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, we've confirmed your payment of ₦{{amount}} for order #{{orderNumber}}. Your order is now being prepared.",
    url: "{{orderUrl}}",
    params: { firstName: "string", orderNumber: "string", amount: "number", orderUrl: "string" },
  },

  ORDER_PAYMENT_FAILED: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Payment failed for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, your payment of ₦{{amount}} for order #{{orderNumber}} couldn't be processed. Please try again or use a different card.",
    url: "{{retryUrl}}",
    params: { firstName: "string", orderNumber: "string", amount: "number", retryUrl: "string" },
  },

  ORDER_PACKED: {
    channels: ["IN_APP"],
    subject: "Order #{{orderNumber}} is packed",
    message:
      "Hi {{firstName}}, your order #{{orderNumber}} is packed and will be dispatched soon.",
    url: "{{orderUrl}}",
    params: { firstName: "string", orderNumber: "string", orderUrl: "string" },
  },

  ORDER_OUT_FOR_DELIVERY: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Order #{{orderNumber}} is on the way",
    message:
      "Hi {{firstName}}, your order #{{orderNumber}} is out for delivery. Expected between {{window}}. Our rider will call you when close.",
    url: "{{orderUrl}}",
    params: { firstName: "string", orderNumber: "string", window: "string", orderUrl: "string" },
  },

  ORDER_DELIVERED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Order #{{orderNumber}} delivered",
    message:
      "Hi {{firstName}}, your order #{{orderNumber}} has been delivered. We'd love to hear how it went — tap to rate your experience.",
    url: "{{rateUrl}}",
    params: { firstName: "string", orderNumber: "string", rateUrl: "string" },
  },

  ORDER_CANCELLED: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Order #{{orderNumber}} cancelled",
    message:
      "Hi {{firstName}}, your order #{{orderNumber}} has been cancelled. Reason: {{reason}}. Any payment will be refunded to your original payment method within 3–5 business days.",
    params: { firstName: "string", orderNumber: "string", reason: "string" },
  },

  ORDER_REFUNDED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Refund issued for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, we've issued a refund of ₦{{amount}} for order #{{orderNumber}}. It may take 3–5 business days to reflect.",
    params: { firstName: "string", orderNumber: "string", amount: "number" },
  },

  ORDER_RETURN_APPROVED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Return approved for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, your return request for order #{{orderNumber}} has been approved. Refund of ₦{{amount}} will be processed shortly.",
    params: { firstName: "string", orderNumber: "string", amount: "number" },
  },

  ORDER_RETURN_REJECTED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Return update for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, your return request for order #{{orderNumber}} could not be approved. Reason: {{reason}}. Contact support if you have questions.",
    params: { firstName: "string", orderNumber: "string", reason: "string" },
  },

  ORDER_RATING_REQUEST: {
    channels: ["IN_APP"],
    subject: "How was order #{{orderNumber}}?",
    message:
      "Hi {{firstName}}, we'd love your feedback on order #{{orderNumber}}. It takes 10 seconds.",
    url: "{{rateUrl}}",
    params: { firstName: "string", orderNumber: "string", rateUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // CART & CHECKOUT
  // ─────────────────────────────────────────────────────────────
  CART_ABANDONED: {
    channels: ["EMAIL"],
    subject: "You left something in your cart",
    message:
      "Hi {{firstName}}, your cart is still waiting — {{itemCount}} item(s) totalling ₦{{total}}. Complete your order before they sell out.",
    url: "{{cartUrl}}",
    params: { firstName: "string", itemCount: "number", total: "number", cartUrl: "string" },
  },

  CART_PRICE_DROP: {
    channels: ["IN_APP"],
    subject: "Price dropped on items in your cart",
    message:
      "Hi {{firstName}}, {{itemCount}} item(s) in your cart just got cheaper. Tap to check them out.",
    url: "{{cartUrl}}",
    params: { firstName: "string", itemCount: "number", cartUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // MEMBERSHIP / SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────
  MEMBERSHIP_WELCOME: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Welcome to {{planName}}",
    message:
      "Hi {{firstName}}, your {{planName}} membership is now active. Next delivery: {{nextDeliveryAt}}.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", nextDeliveryAt: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_PAYMENT_FAILED: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Membership payment failed",
    message:
      "Hi {{firstName}}, we couldn't process your {{planName}} payment of ₦{{amount}}. We'll retry once more; update your card to avoid pausing deliveries.",
    url: "{{updatePaymentUrl}}",
    params: { firstName: "string", planName: "string", amount: "number", updatePaymentUrl: "string" },
  },

  MEMBERSHIP_PAYMENT_RETRY: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Retrying your membership payment",
    message:
      "Hi {{firstName}}, we're retrying your {{planName}} payment of ₦{{amount}} today. No action needed unless it fails.",
    params: { firstName: "string", planName: "string", amount: "number" },
  },

  MEMBERSHIP_RENEWED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership renewed",
    message:
      "Hi {{firstName}}, your {{planName}} membership has been renewed. Next billing: {{nextBillingAt}}.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", nextBillingAt: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_PAUSED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership paused",
    message:
      "Hi {{firstName}}, your {{planName}} membership is paused. Resume anytime from your account.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_RESUMED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership resumed",
    message:
      "Hi {{firstName}}, your {{planName}} membership is active again. Next delivery: {{nextDeliveryAt}}.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", nextDeliveryAt: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_PLAN_CHANGED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Plan changed to {{newPlanName}}",
    message:
      "Hi {{firstName}}, your membership has been changed from {{oldPlanName}} to {{newPlanName}}. It takes effect on {{effectiveAt}}.",
    params: { firstName: "string", oldPlanName: "string", newPlanName: "string", effectiveAt: "string" },
  },

  MEMBERSHIP_DELIVERY_SKIPPED: {
    channels: ["IN_APP"],
    subject: "Delivery skipped",
    message:
      "Hi {{firstName}}, your next delivery has been skipped. Your following delivery will be on {{nextDeliveryAt}}.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", nextDeliveryAt: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_DELIVERY_REMINDER: {
    channels: ["EMAIL", "SMS", "IN_APP"],
    subject: "Delivery tomorrow",
    message:
      "Hi {{firstName}}, your {{planName}} delivery is scheduled for tomorrow between {{window}}. Update your mix or skip from your account.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", window: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_DELIVERED: {
    channels: ["IN_APP"],
    subject: "Delivery received",
    message:
      "Hi {{firstName}}, your {{planName}} delivery was received today. Let us know how it was.",
    url: "{{subscriptionUrl}}",
    params: { firstName: "string", planName: "string", subscriptionUrl: "string" },
  },

  MEMBERSHIP_CANCELLED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership cancelled",
    message:
      "Hi {{firstName}}, your {{planName}} membership has been cancelled. You can rejoin anytime. We'd love to know why — reply to this email.",
    params: { firstName: "string", planName: "string", reason: "string" },
  },

  MEMBERSHIP_EXPIRED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership expired",
    message:
      "Hi {{firstName}}, your {{planName}} membership has expired. Restart it to keep your deliveries coming.",
    url: "{{renewUrl}}",
    params: { firstName: "string", planName: "string", renewUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // LOYALTY & REFERRALS
  // ─────────────────────────────────────────────────────────────
  LOYALTY_POINTS_EARNED: {
    channels: ["IN_APP"],
    subject: "You earned {{points}} points",
    message:
      "Hi {{firstName}}, you earned {{points}} loyalty points from order #{{orderNumber}}. Balance: {{balance}} points.",
    url: "{{loyaltyUrl}}",
    params: { firstName: "string", points: "number", orderNumber: "string", balance: "number", loyaltyUrl: "string" },
  },

  LOYALTY_POINTS_REDEEMED: {
    channels: ["IN_APP"],
    subject: "Points redeemed",
    message:
      "Hi {{firstName}}, you redeemed {{points}} points for ₦{{value}} off. New balance: {{balance}} points.",
    params: { firstName: "string", points: "number", value: "number", balance: "number" },
  },

  REFERRAL_REWARD: {
    channels: ["EMAIL", "IN_APP"],
    subject: "You earned ₦{{amount}} in store credit",
    message:
      "Hi {{firstName}}, {{referredName}} used your referral code. You've earned ₦{{amount}} in store credit — use it on your next order.",
    url: "{{storeCreditUrl}}",
    params: { firstName: "string", referredName: "string", amount: "number", storeCreditUrl: "string" },
  },

  REFERRAL_INVITE: {
    channels: ["EMAIL"],
    subject: "{{referrerName}} invited you to Luxol Market",
    message:
      "Hi, {{referrerName}} thinks you'll love Luxol Market — fresh meat, groceries and livestock delivered. Use code {{code}} for ₦{{discount}} off your first order.",
    url: "{{signupUrl}}",
    params: { referrerName: "string", code: "string", discount: "number", signupUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // PROMOTIONS
  // ─────────────────────────────────────────────────────────────
  PROMO_ANNOUNCEMENT: {
    channels: ["EMAIL", "IN_APP"],
    subject: "{{promoTitle}}",
    message:
      "Hi {{firstName}}, {{promoDescription}}. Use code {{code}} before {{expiresAt}}.",
    url: "{{promoUrl}}",
    params: { firstName: "string", promoTitle: "string", promoDescription: "string", code: "string", expiresAt: "string", promoUrl: "string" },
  },

  PROMO_EXPIRING_SOON: {
    channels: ["IN_APP"],
    subject: "Your {{code}} code expires soon",
    message:
      "Hi {{firstName}}, code {{code}} expires in {{hoursLeft}} hours. Use it before it's gone.",
    url: "{{promoUrl}}",
    params: { firstName: "string", code: "string", hoursLeft: "number", promoUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // STORE CREDIT
  // ─────────────────────────────────────────────────────────────
  STORE_CREDIT_ADDED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Store credit added",
    message:
      "Hi {{firstName}}, ₦{{amount}} store credit has been added to your account. Reason: {{reason}}. New balance: ₦{{balance}}.",
    url: "{{walletUrl}}",
    params: { firstName: "string", amount: "number", reason: "string", balance: "number", walletUrl: "string" },
  },

  STORE_CREDIT_USED: {
    channels: ["IN_APP"],
    subject: "Store credit applied",
    message:
      "Hi {{firstName}}, ₦{{amount}} store credit was applied to order #{{orderNumber}}. Remaining balance: ₦{{balance}}.",
    params: { firstName: "string", amount: "number", orderNumber: "string", balance: "number" },
  },

  // ─────────────────────────────────────────────────────────────
  // OUT OF STOCK & SUBSTITUTIONS
  // ─────────────────────────────────────────────────────────────
  ORDER_ITEM_OUT_OF_STOCK: {
    channels: ["IN_APP", "SMS"],
    subject: "Item unavailable in order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, \"{{productName}}\" is out of stock. We can auto-substitute, refund to credit, or skip it — tell us your preference.",
    url: "{{preferenceUrl}}",
    params: { firstName: "string", orderNumber: "string", productName: "string", preferenceUrl: "string" },
  },

  ORDER_SUBSTITUTION_PROPOSED: {
    channels: ["IN_APP", "SMS"],
    subject: "Approve substitution for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, we'd like to swap \"{{originalProduct}}\" for \"{{substituteProduct}}\" ({{priceChange}}). Approve or decline in your order.",
    url: "{{approveUrl}}",
    params: { firstName: "string", orderNumber: "string", originalProduct: "string", substituteProduct: "string", priceChange: "string", approveUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // LIVESTOCK (weight variance)
  // ─────────────────────────────────────────────────────────────
  LIVESTOCK_WEIGHT_CONFIRMED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Final weight confirmed for order #{{orderNumber}}",
    message:
      "Hi {{firstName}}, your livestock order #{{orderNumber}} weighed {{finalWeight}}kg (estimated {{estimatedWeight}}kg). Final price: ₦{{finalPrice}}. Difference of ₦{{variance}} will be settled via store credit.",
    url: "{{orderUrl}}",
    params: { firstName: "string", orderNumber: "string", finalWeight: "number", estimatedWeight: "number", finalPrice: "number", variance: "number", orderUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // ADMIN / STAFF
  // ─────────────────────────────────────────────────────────────
  ADMIN_NEW_ORDER: {
    channels: ["EMAIL", "IN_APP"],
    subject: "New order #{{orderNumber}} — ₦{{total}}",
    message:
      "{{customerName}} placed order #{{orderNumber}} for ₦{{total}} ({{itemsCount}} items). {{deliveryType}}.",
    url: "{{adminOrderUrl}}",
    params: { customerName: "string", orderNumber: "string", total: "number", itemsCount: "number", deliveryType: "string", adminOrderUrl: "string" },
  },

  ADMIN_PAYMENT_FAILED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Payment failed — order #{{orderNumber}}",
    message:
      "Payment of ₦{{amount}} for order #{{orderNumber}} ({{customerName}}) failed. Reason: {{reason}}.",
    url: "{{adminOrderUrl}}",
    params: { amount: "number", orderNumber: "string", customerName: "string", reason: "string", adminOrderUrl: "string" },
  },

  ADMIN_LARGE_ORDER: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Large order: #{{orderNumber}} — ₦{{total}}",
    message:
      "{{customerName}} just placed a large order #{{orderNumber}} for ₦{{total}}. Worth a personal follow-up.",
    url: "{{adminOrderUrl}}",
    params: { customerName: "string", orderNumber: "string", total: "number", adminOrderUrl: "string" },
  },

  ADMIN_LOW_STOCK: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Low stock: {{productName}}",
    message:
      "\"{{productName}}\" is running low ({{stock}} left, reorder level {{reorderLevel}}). Consider restocking soon.",
    url: "{{adminProductUrl}}",
    params: { productName: "string", stock: "number", reorderLevel: "number", adminProductUrl: "string" },
  },

  ADMIN_OUT_OF_STOCK: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Out of stock: {{productName}}",
    message:
      "\"{{productName}}\" is out of stock. Restock immediately to avoid losing sales.",
    url: "{{adminProductUrl}}",
    params: { productName: "string", adminProductUrl: "string" },
  },

  ADMIN_MEMBERSHIP_NEW: {
    channels: ["EMAIL", "IN_APP"],
    subject: "New membership: {{customerName}} joined {{planName}}",
    message:
      "{{customerName}} just subscribed to {{planName}} (₦{{price}}/{{interval}}).",
    url: "{{adminSubscriberUrl}}",
    params: { customerName: "string", planName: "string", price: "number", interval: "string", adminSubscriberUrl: "string" },
  },

  ADMIN_MEMBERSHIP_FAILED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "Membership payment failed: {{customerName}}",
    message:
      "Payment for {{customerName}}'s {{planName}} membership (₦{{amount}}) failed. Attempt {{attempt}} of {{maxAttempts}}.",
    url: "{{adminSubscriberUrl}}",
    params: { customerName: "string", planName: "string", amount: "number", attempt: "number", maxAttempts: "number", adminSubscriberUrl: "string" },
  },

  ADMIN_INVITE_ACCEPTED: {
    channels: ["EMAIL", "IN_APP"],
    subject: "{{memberName}} accepted your invitation",
    message:
      "{{memberName}} ({{email}}) has joined the team as {{roleLabel}}.",
    url: "{{adminTeamUrl}}",
    params: { memberName: "string", email: "string", roleLabel: "string", adminTeamUrl: "string" },
  },

  ADMIN_STAFF_NEW_DEVICE: {
    channels: ["EMAIL", "IN_APP"],
    subject: "New device sign-in: {{memberName}}",
    message:
      "{{memberName}} signed in from a new device: {{device}} ({{ip}}, {{location}}). If this looks suspicious, investigate.",
    url: "{{adminSecurityUrl}}",
    params: { memberName: "string", device: "string", ip: "string", location: "string", adminSecurityUrl: "string" },
  },

  // ─────────────────────────────────────────────────────────────
  // NEWSLETTER
  // ─────────────────────────────────────────────────────────────
  NEWSLETTER_SUBSCRIBED: {
    channels: ["EMAIL"],
    subject: "You're subscribed to Luxol Market",
    message:
      "Thanks for subscribing. You'll be the first to know about new arrivals and seasonal offers.",
    url: "{{preferencesUrl}}",
    params: { preferencesUrl: "string" },
  },
} as const;

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES;