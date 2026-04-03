import { runScoringAction } from "@/app/actions";
import { listPriorityQueue } from "@/lib/shop";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ scored?: string }>;
};

export default async function PriorityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const scored = sp.scored;
  const queue = await listPriorityQueue();

  return (
    <>
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fraud operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Verification queue</h1>
        <p className="mt-2 text-zinc-600">
          Orders sorted by <strong>risk score</strong> (highest first) so your team reviews the most
          suspicious activity before fulfillment.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Run scoring after new orders arrive to refresh rankings. On Vercel, use the same heuristic
          scorer as the local C# fallback (ML.NET zip is not loaded in this Node deployment).
        </p>
      </div>

      {scored ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
          Scoring finished — updated <strong>{scored}</strong> orders. The queue below is sorted by
          risk (highest first).
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <form action={runScoringAction}>
          <button
            type="submit"
            className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-amber-400"
          >
            Run scoring
          </button>
        </form>
        <span className="text-sm text-zinc-600">
          Applies the fraud heuristic to all orders and updates risk scores.
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Placed</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">Risk score</th>
              <th className="px-3 py-3">Training label</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {queue.map((o) => (
              <tr key={o.orderId} className="hover:bg-zinc-50/80">
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">#{o.orderId}</td>
                <td className="px-3 py-2 whitespace-nowrap">{o.orderDateTime}</td>
                <td className="px-3 py-2">{o.customerName}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {o.orderTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {o.riskScore.toFixed(1)}
                </td>
                <td className="px-3 py-2">
                  {o.isFraud ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      Fraud
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
                      Legitimate
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
