import Link from "next/link";
import { createOrderAction } from "@/app/actions";
import { getCustomer, listProducts } from "@/lib/shop";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    customerId?: string;
    created?: string;
    error?: string;
  }>;
};

export default async function NewOrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const customerId = Number(sp.customerId);
  if (!Number.isFinite(customerId)) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-red-700 shadow-sm">
        Missing customer.{" "}
        <Link className="font-semibold underline" href="/customers">
          Back to customers
        </Link>
      </div>
    );
  }

  const [customer, products] = await Promise.all([getCustomer(customerId), listProducts()]);
  if (!customer) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-red-700">Customer not found.</p>
        <Link className="mt-3 inline-block font-semibold text-blue-700" href="/customers">
          Back to customers
        </Link>
      </div>
    );
  }

  const created = sp.created;
  const err = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <>
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Checkout</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">New order</h1>
        <p className="mt-1 text-lg text-zinc-600">{customer.fullName}</p>
      </div>

      {created ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
          Order <strong>#{created}</strong> created. Ask an administrator to run scoring to refresh the
          verification queue.
        </div>
      ) : null}

      {err ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm">
          {err}
        </div>
      ) : null}

      <form action={createOrderAction} className="space-y-6">
        <input type="hidden" name="customerId" value={customerId} />

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Checkout details
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Payment method</span>
              <select
                name="paymentMethod"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                defaultValue="card"
              >
                <option value="card">Credit or debit card</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank transfer (ACH / wire)</option>
                <option value="crypto">Cryptocurrency</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Device type</span>
              <select
                name="deviceType"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                defaultValue="desktop"
              >
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">IP country</span>
              <input
                name="ipCountry"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase"
                placeholder="e.g. US"
                maxLength={8}
                defaultValue="US"
              />
              <span className="mt-1 block text-xs text-zinc-500">Two-letter country code.</span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Billing ZIP / postal code</span>
              <input
                name="billingZip"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Optional"
                autoComplete="postal-code"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Shipping ZIP / postal code</span>
              <input
                name="shippingZip"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Optional"
                autoComplete="shipping postal-code"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Shipping state / province</span>
              <input
                name="shippingState"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase"
                placeholder="e.g. CO"
                maxLength={8}
              />
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="promoUsed" className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm font-semibold text-zinc-800">Promo applied to this order</span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Promo code</span>
              <input
                name="promoCode"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="If applicable"
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Line items</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Add one product per row. Leave unused rows blank.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-2">Product</th>
                  <th className="w-28 px-2 py-2">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="px-2 py-2">
                      <select
                        name={`line_${i}_product`}
                        className="w-full rounded-md border border-zinc-300 px-2 py-2"
                        defaultValue="0"
                      >
                        <option value="0">Select product…</option>
                        {products.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.productName} — {p.sku} (
                            {p.price.toLocaleString("en-US", { style: "currency", currency: "USD" })})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        name={`line_${i}_qty`}
                        min={0}
                        defaultValue={0}
                        className="w-full rounded-md border border-zinc-300 px-2 py-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Place order
          </button>
          <Link
            href="/customers"
            className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
