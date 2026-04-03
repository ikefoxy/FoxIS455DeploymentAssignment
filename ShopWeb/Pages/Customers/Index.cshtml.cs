using Microsoft.AspNetCore.Mvc.RazorPages;
using ShopWeb.Services;

namespace ShopWeb.Pages.Customers;

public class IndexModel(ShopRepository repository) : PageModel
{
    public IReadOnlyList<CustomerListItem> Customers { get; private set; } = [];

    public void OnGet() => Customers = repository.ListCustomers();
}
