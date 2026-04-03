"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrder, scoreAllOrders } from "@/lib/shop";

export async function runScoringAction() {
  const n = await scoreAllOrders();
  revalidatePath("/admin/priority");
  revalidatePath("/admin/orders");
  redirect(`/admin/priority?scored=${n}`);
}

export async function createOrderAction(formData: FormData) {
  const customerId = Number(formData.get("customerId"));
  if (!Number.isFinite(customerId)) {
    redirect("/customers?error=invalid");
  }

  const lines: { productId: number; quantity: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const pid = Number(formData.get(`line_${i}_product`));
    const qty = Number(formData.get(`line_${i}_qty`));
    if (pid > 0 && qty > 0) lines.push({ productId: pid, quantity: qty });
  }

  const pm = String(formData.get("paymentMethod") ?? "card").trim().toLowerCase();
  const dev = String(formData.get("deviceType") ?? "desktop").trim().toLowerCase();
  const ipcRaw = String(formData.get("ipCountry") ?? "US").trim();
  const ipCountry = ipcRaw ? ipcRaw.toUpperCase() : "US";
  const billingZip = emptyToNull(String(formData.get("billingZip") ?? ""));
  const shippingZip = emptyToNull(String(formData.get("shippingZip") ?? ""));
  const shippingStateRaw = String(formData.get("shippingState") ?? "").trim();
  const shippingState = shippingStateRaw ? shippingStateRaw.toUpperCase() : null;
  const promoUsed = formData.get("promoUsed") === "on" ? 1 : 0;
  const promoCode = emptyToNull(String(formData.get("promoCode") ?? ""));

  let orderId: number;
  try {
    orderId = await createOrder({
      customerId,
      paymentMethod: pm,
      deviceType: dev,
      ipCountry,
      billingZip,
      shippingZip,
      shippingState,
      promoUsed,
      promoCode,
      lines,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create order.";
    redirect(`/orders/new?customerId=${customerId}&error=${encodeURIComponent(msg)}`);
  }
  redirect(`/orders/new?customerId=${customerId}&created=${orderId}`);
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}
