using ShopWeb.ML;
using ShopWeb.Services;

if (args.Any(a => string.Equals(a, "--train-model", StringComparison.OrdinalIgnoreCase)))
{
    var root = ContentRootResolver.FindShopWebRoot();
    TrainFraudModel.Run(
      Path.Combine(root, "Data", "shop.db"),
      Path.Combine(root, "MLModels", "fraud_model.zip"));
    return;
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ShopRepository>();
builder.Services.AddSingleton<FraudScoringService>();
builder.Services.AddRazorPages();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

app.Run();
