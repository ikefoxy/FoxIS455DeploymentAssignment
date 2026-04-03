using Microsoft.AspNetCore.Mvc.RazorPages;
using ShopWeb.Services;

namespace ShopWeb.Pages.Admin;

public class OrdersModel(ShopRepository repository) : PageModel
{
    public IReadOnlyList<AdminOrderRow> Orders { get; private set; } = [];

    public void OnGet() => Orders = repository.ListOrdersForAdmin();
}
