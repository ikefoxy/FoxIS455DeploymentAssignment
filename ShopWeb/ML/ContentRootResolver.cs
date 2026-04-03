namespace ShopWeb.ML;

public static class ContentRootResolver
{
    /// <summary>Finds the project directory that contains Data/shop.db (works for dotnet run and --train-model).</summary>
    public static string FindShopWebRoot()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            var db = Path.Combine(d.FullName, "Data", "shop.db");
            if (File.Exists(db))
                return d.FullName;
        }

        throw new InvalidOperationException("Could not locate Data/shop.db relative to the application base directory.");
    }
}
