using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ShopWeb.Services;

namespace ShopWeb.Pages.Admin;

public class PriorityModel(ShopRepository repository, FraudScoringService scoring) : PageModel
{
    public IReadOnlyList<PriorityOrderRow> Queue { get; private set; } = [];

    [TempData]
    public string? Flash { get; set; }

    public void OnGet() => Queue = repository.ListPriorityQueue();

    public IActionResult OnPostRunScoring()
    {
        var n = scoring.ScoreAllOrders();
        Flash = $"Scoring finished — updated {n} orders. Priority queue is sorted by risk (highest first).";
        return RedirectToPage();
    }
}
