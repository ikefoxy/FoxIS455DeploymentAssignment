import { listOrdersAdmin } from "@/lib/shop";
import { paymentMethodLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await listOrdersAdmin();

  return (
    <>
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Order history</h1>
        <p className="mt-2 text-zinc-600">Recent orders (up to 500). Amounts in USD.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Placed</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">Risk</th>
              <th className="px-3 py-3">Fraud label</th>
              <th className="px-3 py-3">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map((o) => (
              <tr key={o.orderId} className="hover:bg-zinc-50/80">
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">#{o.orderId}</td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-800">{o.orderDateTime}</td>
                <td className="px-3 py-2">{o.customerName}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {o.orderTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{o.riskScore.toFixed(1)}</td>
                <td className="px-3 py-2">
                  {o.isFraud ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      No
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-800">{paymentMethodLabel(o.paymentMethod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
