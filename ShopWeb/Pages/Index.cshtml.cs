using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ShopWeb.Pages;

public class IndexModel : PageModel
{
    public IActionResult OnGet() => RedirectToPage("/Customers/Index");
}
