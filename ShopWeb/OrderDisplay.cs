namespace ShopWeb;

public static class OrderDisplay
{
    public static string PaymentMethodLabel(string? code) =>
        code?.Trim().ToLowerInvariant() switch
        {
            "card" => "Credit or debit card",
            "paypal" => "PayPal",
            "bank" => "Bank transfer",
            "crypto" => "Cryptocurrency",
            _ => string.IsNullOrWhiteSpace(code) ? "—" : code,
        };
}
