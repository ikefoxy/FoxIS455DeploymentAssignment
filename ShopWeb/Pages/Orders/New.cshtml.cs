using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ShopWeb.Services;

namespace ShopWeb.Pages.Orders;

public class NewModel(ShopRepository repository) : PageModel
{
    [BindProperty(SupportsGet = true)]
    public int CustomerId { get; set; }

    public CustomerListItem? Customer { get; private set; }

    public IReadOnlyList<ProductListItem> Products { get; private set; } = [];

    [BindProperty]
    [Display(Name = "Payment method")]
    public string PaymentMethod { get; set; } = "card";

    [BindProperty]
    [Display(Name = "Device type")]
    public string DeviceType { get; set; } = "desktop";

    [BindProperty]
    [Display(Name = "IP country")]
    public string IpCountry { get; set; } = "US";

    [BindProperty]
    [Display(Name = "Billing ZIP / postal code")]
    public string? BillingZip { get; set; }

    [BindProperty]
    [Display(Name = "Shipping ZIP / postal code")]
    public string? ShippingZip { get; set; }

    [BindProperty]
    [Display(Name = "Shipping state / province")]
    public string? ShippingState { get; set; }

    [BindProperty]
    [Display(Name = "Promo applied to this order")]
    public bool PromoUsedBool { get; set; }

    [BindProperty]
    [Display(Name = "Promo code")]
    public string? PromoCode { get; set; }

    [BindProperty]
    public LineInput[] Lines { get; set; } = new LineInput[8];

    public string? StatusMessage { get; private set; }

    public void OnGet()
    {
        Customer = repository.GetCustomer(CustomerId);
        Products = repository.ListProducts();
        for (var i = 0; i < Lines.Length; i++)
            Lines[i] ??= new LineInput();
    }

    public IActionResult OnPost()
    {
        Lines ??= new LineInput[8];
        for (var i = 0; i < Lines.Length; i++)
            Lines[i] ??= new LineInput();

        Customer = repository.GetCustomer(CustomerId);
        Products = repository.ListProducts();
        if (Customer is null)
            return NotFound();

        var draft = new NewOrderDraft
        {
            CustomerId = CustomerId,
            PaymentMethod = PaymentMethod.Trim().ToLowerInvariant(),
            DeviceType = DeviceType.Trim().ToLowerInvariant(),
            IpCountry = string.IsNullOrWhiteSpace(IpCountry) ? "US" : IpCountry.Trim().ToUpperInvariant(),
            BillingZip = string.IsNullOrWhiteSpace(BillingZip) ? null : BillingZip.Trim(),
            ShippingZip = string.IsNullOrWhiteSpace(ShippingZip) ? null : ShippingZip.Trim(),
            ShippingState = string.IsNullOrWhiteSpace(ShippingState) ? null : ShippingState.Trim().ToUpperInvariant(),
            PromoUsed = PromoUsedBool ? 1 : 0,
            PromoCode = string.IsNullOrWhiteSpace(PromoCode) ? null : PromoCode.Trim(),
        };

        foreach (var line in Lines)
        {
            if (line.ProductId <= 0 || line.Quantity <= 0)
                continue;
            draft.Lines.Add(new OrderLineDraft { ProductId = line.ProductId, Quantity = line.Quantity });
        }

        try
        {
            var orderId = repository.CreateOrder(draft);
            StatusMessage = $"Order #{orderId} created. Ask an administrator to run scoring to refresh the verification queue.";
        }
        catch (Exception ex)
        {
            StatusMessage = ex.Message;
        }

        return Page();
    }

    public sealed class LineInput
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
    }
}
