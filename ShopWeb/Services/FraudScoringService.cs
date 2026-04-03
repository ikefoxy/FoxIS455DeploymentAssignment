using Microsoft.ML;
using ShopWeb.ML;

namespace ShopWeb.Services;

public sealed class FraudScoringService(
    IWebHostEnvironment env,
    ShopRepository repository,
    ILogger<FraudScoringService> log)
{
    private readonly object _engineLock = new();
    private PredictionEngine<FraudInput, FraudPrediction>? _engine;
    private bool _useHeuristic;
    private readonly string _modelPath = Path.Combine(env.ContentRootPath, "MLModels", "fraud_model.zip");

    public int ScoreAllOrders()
    {
        EnsureEngine();
        var rows = repository.ListOrdersForScoring();
        var updated = 0;
        foreach (var row in rows)
        {
            var prob = PredictProbability(row.Input);
            var risk = Math.Clamp(prob * 100.0, 0, 100);
            repository.UpdateRiskScore(row.OrderId, risk);
            updated++;
        }

        log.LogInformation("Scored {Count} orders; model path {Path}", updated, _modelPath);
        return updated;
    }

    private void EnsureEngine()
    {
        if (_engine is not null || _useHeuristic)
            return;

        lock (_engineLock)
        {
            if (_engine is not null || _useHeuristic)
                return;

            var ctx = new MLContext(seed: 0);
            if (File.Exists(_modelPath))
            {
                var model = ctx.Model.Load(_modelPath, out _);
                _engine = ctx.Model.CreatePredictionEngine<FraudInput, FraudPrediction>(model);
                log.LogInformation("Loaded fraud model from {Path}", _modelPath);
            }
            else
            {
                _useHeuristic = true;
                log.LogWarning("No model at {Path}; using heuristic fallback until you train (see README).", _modelPath);
            }
        }
    }

    private float PredictProbability(FraudInput input)
    {
        EnsureEngine();
        if (_engine is not null)
        {
            lock (_engineLock)
                return _engine.Predict(input).Probability;
        }

        return HeuristicProbability(input);
    }

    private static float HeuristicProbability(FraudInput x)
    {
        var score = 0.1f;
        if (x.PromoUsed > 0) score += 0.15f;
        if (x.OrderTotal > 800) score += 0.2f;
        if (x.IpCountry is not "US" and not "CA") score += 0.25f;
        if (x.PaymentMethod == "crypto") score += 0.15f;
        return Math.Clamp(score, 0f, 1f);
    }
}
