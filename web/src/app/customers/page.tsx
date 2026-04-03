import Link from "next/link";
import { listCustomers } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <>
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Checkout</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Choose a customer
        </h1>
        <p className="mt-2 text-zinc-600">
          No sign-in required. Select a customer to start a new order.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.map((c) => (
              <tr key={c.customerId} className="hover:bg-zinc-50/80">
                <td className="px-4 py-3 font-medium text-zinc-900">{c.fullName}</td>
                <td className="px-4 py-3">
                  <a className="text-blue-700 hover:underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {c.city == null && c.state == null ? "—" : `${c.city ?? ""}, ${c.state ?? ""}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                    href={`/orders/new?customerId=${c.customerId}`}
                  >
                    New order
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
