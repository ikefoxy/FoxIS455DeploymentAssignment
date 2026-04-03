using Microsoft.ML;
using Microsoft.ML.Data;
using Microsoft.ML.Transforms;

namespace ShopWeb.ML;

public static class FraudMlPipeline
{
    public static IEstimator<ITransformer> BuildTrainingEstimator(MLContext mlContext) =>
        mlContext.Transforms.Categorical.OneHotEncoding(
                [
                    new InputOutputColumnPair("PayEnc", nameof(FraudInput.PaymentMethod)),
                    new InputOutputColumnPair("DevEnc", nameof(FraudInput.DeviceType)),
                    new InputOutputColumnPair("CountryEnc", nameof(FraudInput.IpCountry)),
                    new InputOutputColumnPair("StateEnc", nameof(FraudInput.ShippingState)),
                    new InputOutputColumnPair("SegEnc", nameof(FraudInput.CustomerSegment)),
                    new InputOutputColumnPair("LoyalEnc", nameof(FraudInput.LoyaltyTier)),
                ],
                outputKind: OneHotEncodingEstimator.OutputKind.Indicator)
            .Append(mlContext.Transforms.Concatenate(
                "Features",
                "PayEnc",
                "DevEnc",
                "CountryEnc",
                "StateEnc",
                "SegEnc",
                "LoyalEnc",
                nameof(FraudInput.PromoUsed),
                nameof(FraudInput.OrderSubtotal),
                nameof(FraudInput.ShippingFee),
                nameof(FraudInput.TaxAmount),
                nameof(FraudInput.OrderTotal)))
            .Append(mlContext.BinaryClassification.Trainers.FastTree(
                labelColumnName: "Label",
                featureColumnName: "Features",
                numberOfLeaves: 20,
                numberOfTrees: 100,
                minimumExampleCountPerLeaf: 10));
}
