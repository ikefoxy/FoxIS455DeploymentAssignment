import json
import os
import textwrap


def md(s):
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in textwrap.dedent(s).strip("\n").split("\n")],
    }


def cs(s):
    src = textwrap.dedent(s).strip("\n") + "\n"
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {
            "dotnet_interactive": {"language": "csharp"},
            "polyglot_notebook": {"kernelName": "csharp"},
        },
        "outputs": [],
        "source": [src],
    }


cells = []

cells.append(
    md(
        """
# IS455 — CRISP-DM: Predicting `is_fraud` (C# / ML.NET)

**Course deployment assignment (Part 2)** — end-to-end pipeline using `shop.db`.

**How to run:** Open in **Visual Studio Code** with **Polyglot Notebooks** / **.NET Interactive**, or Jupyter with the .NET C# kernel. The first code cell restores NuGet packages.
"""
    )
)

cells.append(
    cs(
        r"""
#r "nuget: Microsoft.ML, 5.0.0"
#r "nuget: Microsoft.ML.FastTree, 5.0.0"
#r "nuget: Microsoft.Data.Sqlite, 10.0.5"

using Microsoft.ML;
using Microsoft.ML.Data;
using Microsoft.ML.Transforms;
using Microsoft.Data.Sqlite;
using System.IO;
"""
    )
)

cells.append(
    md(
        """
## 1) Business understanding

**Problem:** Some orders are fraudulent (`orders.is_fraud = 1`). Manual review is expensive, so we need a **risk score** that ranks orders for verification before fulfillment.

**Success criteria:** Useful ranking (AUC on held-out data), probabilities mappable to `risk_score` 0–100, and an exportable `fraud_model.zip` consumed by the ASP.NET app in `ShopWeb/`.
"""
    )
)

cells.append(
    cs(
        r"""
var repoRoot = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), ".."));
var dbPath = Path.Combine(repoRoot, "ShopWeb", "Data", "shop.db");
if (!File.Exists(dbPath))
    dbPath = Path.Combine(repoRoot, "Data", "shop.db");
if (!File.Exists(dbPath))
    throw new FileNotFoundException("Place shop.db at ShopWeb/Data/shop.db (or repo Data/shop.db).", dbPath);

Console.WriteLine($"Using database: {dbPath}");
"""
    )
)

cells.append(
    md(
        """
## 2) Data understanding

Connect to SQLite, profile `orders`, and inspect class imbalance (fraud is typically rare).
"""
    )
)

cells.append(
    cs(
        r"""
using var conn = new SqliteConnection($"Data Source={dbPath}");
conn.Open();
using var cmd = conn.CreateCommand();
cmd.CommandText = "SELECT COUNT(*) FROM orders;";
var total = Convert.ToInt64(cmd.ExecuteScalar());
cmd.CommandText = "SELECT SUM(is_fraud) FROM orders;";
var fraud = Convert.ToInt64(cmd.ExecuteScalar());
Console.WriteLine($"Orders: {total}, labeled fraud: {fraud}, rate: {(100.0 * fraud / total):F2}%");
"""
    )
)

cells.append(
    md(
        """
### Feature-level exploration

Join `customers` for segment/tier fields available at order time. Numeric and categorical order features mirror what the web app records.
"""
    )
)

cells.append(
    cs(
        r"""
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

    [Microsoft.ML.Data.ColumnName("Label")]
    public bool IsFraud { get; set; }
}

List<FraudTrainingRow> LoadRows(string path)
{
    var csb = new SqliteConnectionStringBuilder { DataSource = path };
    var list = new List<FraudTrainingRow>();
    using var c = new SqliteConnection(csb.ConnectionString);
    c.Open();
    using var q = c.CreateCommand();
    q.CommandText =
        "SELECT o.payment_method, o.device_type, o.ip_country, o.promo_used, "
        + "o.order_subtotal, o.shipping_fee, o.tax_amount, o.order_total, "
        + "COALESCE(o.shipping_state, 'UNK'), COALESCE(c.customer_segment, 'UNK'), "
        + "COALESCE(c.loyalty_tier, 'UNK'), o.is_fraud "
        + "FROM orders o JOIN customers c ON c.customer_id = o.customer_id";
    using var r = q.ExecuteReader();
    while (r.Read())
    {
        list.Add(new FraudTrainingRow
        {
            PaymentMethod = r.GetString(0),
            DeviceType = r.GetString(1),
            IpCountry = r.GetString(2),
            PromoUsed = (float)r.GetInt64(3),
            OrderSubtotal = (float)r.GetDouble(4),
            ShippingFee = (float)r.GetDouble(5),
            TaxAmount = (float)r.GetDouble(6),
            OrderTotal = (float)r.GetDouble(7),
            ShippingState = r.GetString(8),
            CustomerSegment = r.GetString(9),
            LoyaltyTier = r.GetString(10),
            IsFraud = r.GetInt64(11) != 0,
        });
    }
    return list;
}

var rows = LoadRows(dbPath);
Console.WriteLine($"Loaded {rows.Count} labeled rows.");
"""
    )
)

cells.append(
    md(
        """
## 3) Data preparation

Replace missing location fields with `"UNK"` at extract time. Build an automated `EstimatorChain`: one-hot categoricals, concatenate numeric features, then a tree ensemble — aligned with `ShopWeb/ML/FraudMlPipeline.cs`.
"""
    )
)

cells.append(
    cs(
        r"""
var ml = new MLContext(seed: 42);
var data = ml.Data.LoadFromEnumerable(rows);
var split = ml.Data.TrainTestSplit(data, testFraction: 0.2);

var cat = ml.Transforms.Categorical.OneHotEncoding(
    new[] {
        new InputOutputColumnPair("PayEnc", nameof(FraudTrainingRow.PaymentMethod)),
        new InputOutputColumnPair("DevEnc", nameof(FraudTrainingRow.DeviceType)),
        new InputOutputColumnPair("CountryEnc", nameof(FraudTrainingRow.IpCountry)),
        new InputOutputColumnPair("StateEnc", nameof(FraudTrainingRow.ShippingState)),
        new InputOutputColumnPair("SegEnc", nameof(FraudTrainingRow.CustomerSegment)),
        new InputOutputColumnPair("LoyalEnc", nameof(FraudTrainingRow.LoyaltyTier)),
    },
    outputKind: OneHotEncodingEstimator.OutputKind.Indicator);

var featurePipe = cat.Append(ml.Transforms.Concatenate(
    "Features",
    "PayEnc", "DevEnc", "CountryEnc", "StateEnc", "SegEnc", "LoyalEnc",
    nameof(FraudTrainingRow.PromoUsed),
    nameof(FraudTrainingRow.OrderSubtotal),
    nameof(FraudTrainingRow.ShippingFee),
    nameof(FraudTrainingRow.TaxAmount),
    nameof(FraudTrainingRow.OrderTotal)));

var trainer = ml.BinaryClassification.Trainers.FastTree(
    labelColumnName: "Label",
    featureColumnName: "Features",
    numberOfLeaves: 20,
    numberOfTrees: 100,
    minimumExampleCountPerLeaf: 10);

var pipeline = featurePipe.Append(trainer);
var model = pipeline.Fit(split.TrainSet);
Console.WriteLine("Model trained.");
"""
    )
)

cells.append(
    md(
        """
## 4) Modeling

**FastTree** gradient boosting (tree ensemble) for binary classification — matches the course’s classification + ensembles emphasis while training quickly on CPU.
"""
    )
)

cells.append(
    md(
        """
## 5) Evaluation

Accuracy, AUC, and F1 on a 20% holdout. For rare fraud, emphasize **AUC** and thresholding (extend with a sweep if your rubric asks for cost-based decisions).
"""
    )
)

cells.append(
    cs(
        r"""
public sealed class FraudPrediction
{
    [ColumnName("PredictedLabel")]
    public bool PredictedLabel { get; set; }
    public float Probability { get; set; }
    public float Score { get; set; }
}

var scored = model.Transform(split.TestSet);
var metrics = ml.BinaryClassification.Evaluate(scored, labelColumnName: "Label");
Console.WriteLine($"Accuracy: {metrics.Accuracy:P2}");
Console.WriteLine($"AUC: {metrics.AreaUnderRocCurve:P2}");
Console.WriteLine($"F1: {metrics.F1Score:P2}");
"""
    )
)

cells.append(
    md(
        """
### Feature selection (Ch. 16 — extension ideas)

This notebook keeps a **compact, deployable** feature set aligned with the web form. For extra credit / research, try ML.NET feature selection transforms (for example, mutual-information or model-based selection) **before** the trainer, or compare against a `LbfgsLogisticRegression` baseline on the same concatenated feature vector.
"""
    )
)

cells.append(
    md(
        """
## 6) Deployment (Ch. 17)

Export `fraud_model.zip` into `ShopWeb/MLModels/`. The published site loads it from disk and writes `orders.risk_score = probability * 100` for all rows when an admin runs **Run Scoring** (see `FraudScoringService`).
"""
    )
)

cells.append(
    cs(
        r"""
var outDir = Path.Combine(repoRoot, "ShopWeb", "MLModels");
Directory.CreateDirectory(outDir);
var outPath = Path.Combine(outDir, "fraud_model.zip");
ml.Model.Save(model, split.TrainSet.Schema, outPath);
Console.WriteLine($"Saved: {outPath}");
"""
    )
)

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": ".NET (C#)", "language": "csharp", "name": ".net-csharp"},
        "language_info": {"name": "C#", "file_extension": ".cs"},
    },
    "nbformat": 4,
    "nbformat_minor": 2,
}

out = os.path.join(os.path.dirname(__file__), "..", "Notebooks", "IS455_Fraud_CRISP_DM.ipynb")
out = os.path.normpath(out)
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("Wrote", out)
