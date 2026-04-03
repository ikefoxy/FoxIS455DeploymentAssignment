using Microsoft.Data.Sqlite;
using ShopWeb.ML;

namespace ShopWeb.Services;

public sealed class ShopRepository(IWebHostEnvironment env)
{
    private SqliteConnection OpenConnection()
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "shop.db");
        var csb = new SqliteConnectionStringBuilder { DataSource = path };
        var conn = new SqliteConnection(csb.ConnectionString);
        conn.Open();
        return conn;
    }

    public IReadOnlyList<CustomerListItem> ListCustomers()
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT customer_id, full_name, email, city, state
            FROM customers
            WHERE is_active = 1
            ORDER BY full_name
            """;
        var list = new List<CustomerListItem>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new CustomerListItem(
                r.GetInt32(0),
                r.GetString(1),
                r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3),
                r.IsDBNull(4) ? null : r.GetString(4)));
        }

        return list;
    }

    public CustomerListItem? GetCustomer(int customerId)
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT customer_id, full_name, email, city, state
            FROM customers WHERE customer_id = $id
            """;
        cmd.Parameters.AddWithValue("$id", customerId);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new CustomerListItem(
            r.GetInt32(0),
            r.GetString(1),
            r.GetString(2),
            r.IsDBNull(3) ? null : r.GetString(3),
            r.IsDBNull(4) ? null : r.GetString(4));
    }

    public IReadOnlyList<ProductListItem> ListProducts()
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT product_id, sku, product_name, category, price
            FROM products
            WHERE is_active = 1
            ORDER BY product_name
            """;
        var list = new List<ProductListItem>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new ProductListItem(
                r.GetInt32(0),
                r.GetString(1),
                r.GetString(2),
                r.GetString(3),
                r.GetDouble(4)));
        }

        return list;
    }

    public int CreateOrder(NewOrderDraft draft)
    {
        using var conn = OpenConnection();
        using var tx = conn.BeginTransaction();

        double subtotal = 0;
        var lines = new List<(int ProductId, int Qty, double UnitPrice, double LineTotal)>();
        foreach (var line in draft.Lines)
        {
            if (line.Quantity <= 0) continue;
            var price = GetProductPrice(conn, tx, line.ProductId);
            var lineTotal = Math.Round(price * line.Quantity, 2);
            subtotal += lineTotal;
            lines.Add((line.ProductId, line.Quantity, price, lineTotal));
        }

        if (lines.Count == 0)
            throw new InvalidOperationException("Add at least one line item with quantity greater than zero.");

        subtotal = Math.Round(subtotal, 2);
        var shipping = Math.Round(draft.ShippingFee, 2);
        var tax = Math.Round(draft.TaxRate * subtotal, 2);
        var total = Math.Round(subtotal + shipping + tax, 2);

        var now = draft.OrderDateTimeUtc?.ToString("yyyy-MM-dd HH:mm:ss") ?? DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        int orderId;
        using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO orders (
                  customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
                  payment_method, device_type, ip_country, promo_used, promo_code,
                  order_subtotal, shipping_fee, tax_amount, order_total,
                  risk_score, is_fraud)
                VALUES (
                  $cid, $odt, $billz, $shipz, $shipst,
                  $pay, $dev, $ipc, $promo, $promocode,
                  $sub, $shipfee, $tax, $total,
                  $risk, 0)
                """;
            cmd.Parameters.AddWithValue("$cid", draft.CustomerId);
            cmd.Parameters.AddWithValue("$odt", now);
            cmd.Parameters.AddWithValue("$billz", (object?)draft.BillingZip ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$shipz", (object?)draft.ShippingZip ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$shipst", (object?)draft.ShippingState ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$pay", draft.PaymentMethod);
            cmd.Parameters.AddWithValue("$dev", draft.DeviceType);
            cmd.Parameters.AddWithValue("$ipc", draft.IpCountry);
            cmd.Parameters.AddWithValue("$promo", draft.PromoUsed);
            cmd.Parameters.AddWithValue("$promocode", (object?)draft.PromoCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$sub", subtotal);
            cmd.Parameters.AddWithValue("$shipfee", shipping);
            cmd.Parameters.AddWithValue("$tax", tax);
            cmd.Parameters.AddWithValue("$total", total);
            cmd.Parameters.AddWithValue("$risk", 0d); // refreshed by Run Scoring
            cmd.ExecuteNonQuery();
        }

        using (var idCmd = conn.CreateCommand())
        {
            idCmd.Transaction = tx;
            idCmd.CommandText = "SELECT last_insert_rowid();";
            orderId = Convert.ToInt32((long)idCmd.ExecuteScalar()!);
        }

        foreach (var (productId, qty, unitPrice, lineTotal) in lines)
        {
            using var itemCmd = conn.CreateCommand();
            itemCmd.Transaction = tx;
            itemCmd.CommandText = """
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
                VALUES ($oid, $pid, $q, $up, $lt)
                """;
            itemCmd.Parameters.AddWithValue("$oid", orderId);
            itemCmd.Parameters.AddWithValue("$pid", productId);
            itemCmd.Parameters.AddWithValue("$q", qty);
            itemCmd.Parameters.AddWithValue("$up", unitPrice);
            itemCmd.Parameters.AddWithValue("$lt", lineTotal);
            itemCmd.ExecuteNonQuery();
        }

        tx.Commit();
        return orderId;
    }

    private static double GetProductPrice(SqliteConnection conn, SqliteTransaction tx, int productId)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "SELECT price FROM products WHERE product_id = $id AND is_active = 1";
        cmd.Parameters.AddWithValue("$id", productId);
        var o = cmd.ExecuteScalar();
        if (o is null or DBNull)
            throw new InvalidOperationException($"Unknown product id {productId}.");
        return Convert.ToDouble(o);
    }

    public IReadOnlyList<AdminOrderRow> ListOrdersForAdmin()
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT o.order_id, o.order_datetime, c.full_name, o.order_total, o.risk_score, o.is_fraud, o.payment_method
            FROM orders o
            JOIN customers c ON c.customer_id = o.customer_id
            ORDER BY o.order_datetime DESC
            LIMIT 500
            """;
        var list = new List<AdminOrderRow>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new AdminOrderRow(
                r.GetInt32(0),
                r.GetString(1),
                r.GetString(2),
                r.GetDouble(3),
                r.GetDouble(4),
                r.GetInt64(5) != 0,
                r.GetString(6)));
        }

        return list;
    }

    public IReadOnlyList<PriorityOrderRow> ListPriorityQueue()
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT o.order_id, o.order_datetime, c.full_name, o.order_total, o.risk_score, o.is_fraud
            FROM orders o
            JOIN customers c ON c.customer_id = o.customer_id
            ORDER BY o.risk_score DESC, o.order_datetime DESC
            LIMIT 200
            """;
        var list = new List<PriorityOrderRow>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new PriorityOrderRow(
                r.GetInt32(0),
                r.GetString(1),
                r.GetString(2),
                r.GetDouble(3),
                r.GetDouble(4),
                r.GetInt64(5) != 0));
        }

        return list;
    }

    public IReadOnlyList<OrderScoreRow> ListOrdersForScoring()
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT o.order_id, o.payment_method, o.device_type, o.ip_country, o.promo_used,
                   o.order_subtotal, o.shipping_fee, o.tax_amount, o.order_total,
                   COALESCE(o.shipping_state, 'UNK'),
                   COALESCE(c.customer_segment, 'UNK'),
                   COALESCE(c.loyalty_tier, 'UNK')
            FROM orders o
            JOIN customers c ON c.customer_id = o.customer_id
            """;
        var list = new List<OrderScoreRow>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            var input = new FraudInput
            {
                PaymentMethod = r.GetString(1),
                DeviceType = r.GetString(2),
                IpCountry = r.GetString(3),
                PromoUsed = r.GetInt64(4),
                OrderSubtotal = (float)r.GetDouble(5),
                ShippingFee = (float)r.GetDouble(6),
                TaxAmount = (float)r.GetDouble(7),
                OrderTotal = (float)r.GetDouble(8),
                ShippingState = r.GetString(9),
                CustomerSegment = r.GetString(10),
                LoyaltyTier = r.GetString(11),
            };
            list.Add(new OrderScoreRow(r.GetInt32(0), input));
        }

        return list;
    }

    public void UpdateRiskScore(int orderId, double riskScore)
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE orders SET risk_score = $r WHERE order_id = $id";
        cmd.Parameters.AddWithValue("$r", riskScore);
        cmd.Parameters.AddWithValue("$id", orderId);
        cmd.ExecuteNonQuery();
    }
}

public readonly record struct CustomerListItem(int CustomerId, string FullName, string Email, string? City, string? State);

public readonly record struct ProductListItem(int ProductId, string Sku, string ProductName, string Category, double Price);

public readonly record struct AdminOrderRow(int OrderId, string OrderDateTime, string CustomerName, double OrderTotal, double RiskScore, bool IsFraud, string PaymentMethod);

public readonly record struct PriorityOrderRow(int OrderId, string OrderDateTime, string CustomerName, double OrderTotal, double RiskScore, bool IsFraud);

public readonly record struct OrderScoreRow(int OrderId, FraudInput Input);

public sealed class NewOrderDraft
{
    public int CustomerId { get; init; }
    public string PaymentMethod { get; init; } = "card";
    public string DeviceType { get; init; } = "desktop";
    public string IpCountry { get; init; } = "US";
    public string? BillingZip { get; init; }
    public string? ShippingZip { get; init; }
    public string? ShippingState { get; init; }
    public long PromoUsed { get; init; }
    public string? PromoCode { get; init; }
    public double ShippingFee { get; init; } = 9.99;
    public double TaxRate { get; init; } = 0.07;
    public DateTime? OrderDateTimeUtc { get; init; }
    public List<OrderLineDraft> Lines { get; } = [];
}

public sealed class OrderLineDraft
{
    public int ProductId { get; init; }
    public int Quantity { get; init; }
}
