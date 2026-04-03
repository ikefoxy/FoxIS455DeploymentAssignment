export function paymentMethodLabel(code: string | null | undefined): string {
  switch (code?.trim().toLowerCase()) {
    case "card":
      return "Credit or debit card";
    case "paypal":
      return "PayPal";
    case "bank":
      return "Bank transfer";
    case "crypto":
      return "Cryptocurrency";
    default:
      return code?.trim() || "—";
  }
}
