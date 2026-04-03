using Microsoft.ML.Data;

namespace ShopWeb.ML;

public sealed class FraudPrediction
{
    [ColumnName("PredictedLabel")]
    public bool PredictedLabel { get; set; }

    public float Probability { get; set; }
    public float Score { get; set; }
}
