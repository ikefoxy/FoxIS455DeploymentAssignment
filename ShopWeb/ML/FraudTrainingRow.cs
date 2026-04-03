using Microsoft.ML.Data;

namespace ShopWeb.ML;

public sealed class FraudTrainingRow
{
    public string PaymentMethod { get; set; } = "";
    public string DeviceType { get; set; } = "";
    public string IpCountry { get; set; } = "";
    public float PromoUsed { get; set; }
    public float OrderSubtotal { get; set; }
    public float ShippingFee { get; set; }
    public float TaxAmount { get; set; }
    public float OrderTotal { get; set; }
    public string ShippingState { get; set; } = "";
    public string CustomerSegment { get; set; } = "";
    public string LoyaltyTier { get; set; } = "";

    [ColumnName("Label")]
    public bool IsFraud { get; set; }
}
