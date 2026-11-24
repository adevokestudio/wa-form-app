"use client";

import { useState } from "react";
import type { OrderRecord, OrderStatus } from "@/lib/ordersStore";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  cod: "Cash on delivery",
  paid: "Paid",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  cod: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const PAYMENT_METHOD_LABELS: Record<OrderRecord["paymentMethod"], string> = {
  paypal: "PayPal",
  payhere: "PayHere",
  cod: "Cash on delivery",
  bank_transfer: "Bank transfer",
};

export default function OrdersTable({ orders: initialOrders, currency }: { orders: OrderRecord[]; currency: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [updating, setUpdating] = useState<string | null>(null);

  async function setStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      }
    } finally {
      setUpdating(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        No orders yet — once someone checks out from your catalogue, they&apos;ll show up here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="whitespace-nowrap px-4 py-2 font-medium">Placed</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Total</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Customer</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Payment</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-50 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {order.items.map((item) => (
                    <div key={item.productId}>
                      {item.name} x{item.quantity}
                    </div>
                  ))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                  {currency} {order.total.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div>{order.buyer.name}</div>
                  <div className="text-xs text-gray-400">{order.buyer.phone}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center justify-end gap-2 text-xs">
                    {order.status !== "paid" && (
                      <button
                        type="button"
                        disabled={updating === order.id}
                        onClick={() => setStatus(order.id, "paid")}
                        className="font-medium text-green-700 hover:underline disabled:opacity-50"
                      >
                        Mark paid
                      </button>
                    )}
                    {order.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={updating === order.id}
                        onClick={() => setStatus(order.id, "cancelled")}
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
