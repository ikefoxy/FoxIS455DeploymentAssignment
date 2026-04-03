using Microsoft.ML;
using Microsoft.ML.Data;
using Microsoft.Data.Sqlite;

namespace ShopWeb.ML;

public static class TrainFraudModel
{
    public static void Run(string databasePath, string modelOutputPath)
    {
        var rows = LoadRows(databasePath);
        if (rows.Count < 50)
            throw new InvalidOperationException("Not enough labeled orders to train.");

        var mlContext = new MLContext(seed: 42);
        var data = mlContext.Data.LoadFromEnumerable(rows);
        var split = mlContext.Data.TrainTestSplit(data, testFraction: 0.2);
        var pipeline = FraudMlPipeline.BuildTrainingEstimator(mlContext);
        var model = pipeline.Fit(split.TrainSet);

        Directory.CreateDirectory(Path.GetDirectoryName(modelOutputPath)!);
        mlContext.Model.Save(model, split.TrainSet.Schema, modelOutputPath);

        var predictions = model.Transform(split.TestSet);
        var metrics = mlContext.BinaryClassification.Evaluate(predictions, labelColumnName: "Label");

        Console.WriteLine($"Accuracy: {metrics.Accuracy:P2}");
        Console.WriteLine($"AUC: {metrics.AreaUnderRocCurve:P2}");
        Console.WriteLine($"F1: {metrics.F1Score:P2}");
        Console.WriteLine($"Model saved to {modelOutputPath}");
    }

    private static List<FraudTrainingRow> LoadRows(string databasePath)
    {
        var csb = new SqliteConnectionStringBuilder { DataSource = databasePath };
        var list = new List<FraudTrainingRow>();
        using var conn = new SqliteConnection(csb.ConnectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT o.payment_method, o.device_type, o.ip_country, o.promo_used,
                   o.order_subtotal, o.shipping_fee, o.tax_amount, o.order_total,
                   COALESCE(o.shipping_state, 'UNK'),
                   COALESCE(c.customer_segment, 'UNK'),
                   COALESCE(c.loyalty_tier, 'UNK'),
                   o.is_fraud
            FROM orders o
            JOIN customers c ON c.customer_id = o.customer_id
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new FraudTrainingRow
            {
                PaymentMethod = reader.GetString(0),
                DeviceType = reader.GetString(1),
                IpCountry = reader.GetString(2),
                PromoUsed = (float)reader.GetInt64(3),
                OrderSubtotal = (float)reader.GetDouble(4),
                ShippingFee = (float)reader.GetDouble(5),
                TaxAmount = (float)reader.GetDouble(6),
                OrderTotal = (float)reader.GetDouble(7),
                ShippingState = reader.GetString(8),
                CustomerSegment = reader.GetString(9),
                LoyaltyTier = reader.GetString(10),
                IsFraud = reader.GetInt64(11) != 0,
            });
        }

        return list;
    }
}
