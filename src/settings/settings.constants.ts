import { Role } from "../generated/prisma/client.js";

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATIONS_MANAGER: "Operations Manager",
  INVENTORY_MANAGER: "Inventory Manager",
  SUPPORT: "Support",
};

/** Roles that can be assigned to staff (excludes CUSTOMER). */
export const STAFF_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "INVENTORY_MANAGER",
  "SUPPORT",
];

export const SOUND_OPTIONS = [
  { value: "chime", label: "Chime" },
  { value: "bell", label: "Bell" },
  { value: "ping", label: "Ping" },
  { value: "none", label: "None" },
];

/**
 * Notification catalogue — the source of truth for what events exist.
 * The frontend renders whichever keys the backend sends.
 */
export const NOTIFICATION_GROUPS = [
  {
    id: "orders",
    title: "Orders & Deliveries",
    description: "New orders, delivery status changes",
    items: [
      { key: "orders.new", label: "New orders", defaults: { email: true, push: true } },
      { key: "orders.delivered", label: "Order delivered", defaults: { email: false, push: true } },
      { key: "orders.cancelled", label: "Order cancelled", defaults: { email: true, push: true } },
      { key: "orders.failed_payment", label: "Failed payments", defaults: { email: true, push: true } },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock alerts and restock reminders",
    items: [
      { key: "inventory.low_stock", label: "Low stock alerts", defaults: { email: true, push: true } },
      { key: "inventory.out_of_stock", label: "Out of stock alerts", defaults: { email: true, push: true } },
      { key: "inventory.restock_due", label: "Restock reminders", defaults: { email: false, push: true } },
    ],
  },
  {
    id: "memberships",
    title: "Memberships",
    description: "Subscription events",
    items: [
      { key: "membership.new", label: "New subscriptions", defaults: { email: true, push: false } },
      { key: "membership.renewal_due", label: "Renewals due", defaults: { email: true, push: false } },
      { key: "membership.cancelled", label: "Cancellations", defaults: { email: true, push: false } },
      { key: "membership.payment_failed", label: "Failed membership payments", defaults: { email: true, push: true } },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    description: "Customer activity worth knowing",
    items: [
      { key: "customers.new", label: "New customer signups", defaults: { email: false, push: false } },
      { key: "customers.review", label: "New reviews", defaults: { email: false, push: true } },
    ],
  },
  {
    id: "team",
    title: "Team",
    description: "Admin account activity",
    items: [
      { key: "team.invite_accepted", label: "Invitations accepted", defaults: { email: true, push: false } },
      { key: "team.login", label: "Sign-ins from new devices", defaults: { email: true, push: true } },
    ],
  },
];