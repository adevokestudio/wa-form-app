import { promises as fs } from "fs";
import path from "path";

/**
 * Server-only JSON-file store for Catalogue/Cart orders — same pattern as
 * formsStore.ts / submissionsStore.ts (good enough for this scale, swap for
 * a real database table later if it's ever needed).
 *
 * An order is richer than a plain form submission (lib/submissionsStore.ts):
 * it carries line items with server-computed prices, a payment method, and
 * a status that gets updated after the fact (manually, or automatically for
 * PayHere via its signed webhook — see app/api/payhere/notify/route.ts).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

export interface OrderItem {
  productId: string;
  name: string;
  /** Snapshotted at order time — a later price change on the product
   * never rewrites what a customer was already quoted. */
  price: number;
  quantity: number;
}

export type OrderPaymentMethod = "paypal" | "payhere" | "cod" | "bank_transfer";

/**
 * "pending_payment": an online method (PayPal/PayHere) or bank transfer
 * was chosen and no payment has been confirmed yet.
 * "cod": cash on delivery — nothing to collect online; this is its
 * resting state, not a step on the way to "paid".
 * "paid": confirmed — automatically for PayHere (verified webhook), or
 * manually marked by the client/admin for everything else.
 * "cancelled": manually cancelled.
 */
export type OrderStatus = "pending_payment" | "cod" | "paid" | "cancelled";

export interface OrderBuyer {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export interface OrderRecord {
  id: string;
  formSlug: string;
  ownerId: string;
  items: OrderItem[];
  total: number;
  currency: string;
  buyer: OrderBuyer;
  paymentMethod: OrderPaymentMethod;
  status: OrderStatus;
  /** PayPal.me link (paypal) shown to the customer, if applicable. */
  paymentLink?: string;
  /** The order_id sent to PayHere — used to match its notify webhook back
   * to this order. Only set for paymentMethod "payhere". */
  payhereOrderId?: string;
  createdAt: string;
  paidAt?: string;
}

async function readAll(): Promise<OrderRecord[]> {
  try {
    const raw = await fs.readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(raw) as OrderRecord[];
  } catch {
    return [];
  }
}

async function writeAll(orders: OrderRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

export async function appendOrder(order: OrderRecord): Promise<void> {
  const orders = await readAll();
  orders.push(order);
  await writeAll(orders);
}

export async function listOrdersForForm(formSlug: string): Promise<OrderRecord[]> {
  const all = await readAll();
  return all.filter((o) => o.formSlug === formSlug);
}

/** Every order belonging to one account — mirrors formsStore's listForms,
 * including the admin ?client=<id> override pattern used throughout. */
export async function listOrdersForOwner(ownerId: string): Promise<OrderRecord[]> {
  const all = await readAll();
  return all.filter((o) => o.ownerId === ownerId);
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function getOrderByPayhereOrderId(payhereOrderId: string): Promise<OrderRecord | null> {
  const all = await readAll();
  return all.find((o) => o.payhereOrderId === payhereOrderId) ?? null;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderRecord | null> {
  const orders = await readAll();
  const index = orders.findIndex((o) => o.id === id);
  if (index < 0) return null;

  orders[index] = {
    ...orders[index],
    status,
    paidAt: status === "paid" ? new Date().toISOString() : orders[index].paidAt,
  };
  await writeAll(orders);
  return orders[index];
}

export function makeOrderId(): string {
  return `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
