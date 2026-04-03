import { getDb } from "./db";
import { heuristicProbability } from "./scoring";

export type CustomerRow = {
  customerId: number;
  fullName: string;
  email: string;
  city: string | null;
  state: string | null;
};

export type ProductRow = {
  productId: number;
  sku: string;
  productName: string;
  category: string;
  price: number;
};

export type AdminOrderRow = {
  orderId: number;
  orderDateTime: string;
  customerName: string;
  orderTotal: number;
  riskScore: number;
  isFraud: boolean;
  paymentMethod: string;
};

export type PriorityRow = {
  orderId: number;
  orderDateTime: string;
  customerName: string;
  orderTotal: number;
  riskScore: number;
  isFraud: boolean;
};

export async function listCustomers(): Promise<CustomerRow[]> {
  const db = getDb();
  const rs = await db.execute(`
    SELECT customer_id, full_name, email, city, state
    FROM customers
    WHERE is_active = 1
    ORDER BY full_name
  `);
  return rs.rows.map((row) => ({
    customerId: Number(row[0]),
    fullName: String(row[1]),
    email: String(row[2]),
    city: row[3] == null ? null : String(row[3]),
    state: row[4] == null ? null : String(row[4]),
  }));
}

export async function getCustomer(customerId: number): Promise<CustomerRow | null> {
  const db = getDb();
  const rs = await db.execute({
    sql: `
      SELECT customer_id, full_name, email, city, state
      FROM customers WHERE customer_id = ?
    `,
    args: [customerId],
  });
  if (rs.rows.length === 0) return null;
  const row = rs.rows[0];
  return {
    customerId: Number(row[0]),
    fullName: String(row[1]),
    email: String(row[2]),
    city: row[3] == null ? null : String(row[3]),
    state: row[4] == null ? null : String(row[4]),
  };
}

export async function listProducts(): Promise<ProductRow[]> {
  const db = getDb();
  const rs = await db.execute(`
    SELECT product_id, sku, product_name, category, price
    FROM products
    WHERE is_active = 1
    ORDER BY product_name
  `);
  return rs.rows.map((row) => ({
    productId: Number(row[0]),
    sku: String(row[1]),
    productName: String(row[2]),
    category: String(row[3]),
    price: Number(row[4]),
  }));
}

export async function listOrdersAdmin(): Promise<AdminOrderRow[]> {
  const db = getDb();
  const rs = await db.execute(`
    SELECT o.order_id, o.order_datetime, c.full_name, o.order_total, o.risk_score, o.is_fraud, o.payment_method
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY o.order_datetime DESC
    LIMIT 500
  `);
  return rs.rows.map((row) => ({
    orderId: Number(row[0]),
    orderDateTime: String(row[1]),
    customerName: String(row[2]),
    orderTotal: Number(row[3]),
    riskScore: Number(row[4]),
    isFraud: Number(row[5]) !== 0,
    paymentMethod: String(row[6]),
  }));
}

export async function listPriorityQueue(): Promise<PriorityRow[]> {
  const db = getDb();
  const rs = await db.execute(`
    SELECT o.order_id, o.order_datetime, c.full_name, o.order_total, o.risk_score, o.is_fraud
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY o.risk_score DESC, o.order_datetime DESC
    LIMIT 200
  `);
  return rs.rows.map((row) => ({
    orderId: Number(row[0]),
    orderDateTime: String(row[1]),
    customerName: String(row[2]),
    orderTotal: Number(row[3]),
    riskScore: Number(row[4]),
    isFraud: Number(row[5]) !== 0,
  }));
}

type LineIn = { productId: number; quantity: number };

export async function createOrder(input: {
  customerId: number;
  paymentMethod: string;
  deviceType: string;
  ipCountry: string;
  billingZip: string | null;
  shippingZip: string | null;
  shippingState: string | null;
  promoUsed: number;
  promoCode: string | null;
  lines: LineIn[];
}): Promise<number> {
  const db = getDb();

  let subtotal = 0;
  const resolved: { productId: number; qty: number; unitPrice: number; lineTotal: number }[] = [];
  for (const line of input.lines) {
    if (line.quantity <= 0 || line.productId <= 0) continue;
    const pr = await db.execute({
      sql: "SELECT price FROM products WHERE product_id = ? AND is_active = 1",
      args: [line.productId],
    });
    if (pr.rows.length === 0) throw new Error(`Unknown product id ${line.productId}.`);
    const unitPrice = Number(pr.rows[0][0]);
    const lineTotal = Math.round(unitPrice * line.quantity * 100) / 100;
    subtotal += lineTotal;
    resolved.push({ productId: line.productId, qty: line.quantity, unitPrice, lineTotal });
  }

  if (resolved.length === 0) {
    throw new Error("Add at least one line item with quantity greater than zero.");
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const shippingFee = 9.99;
  const taxRate = 0.07;
  const tax = Math.round(taxRate * subtotal * 100) / 100;
  const total = Math.round((subtotal + shippingFee + tax) * 100) / 100;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const tx = await db.transaction("write");
  try {
    const ins = await tx.execute({
      sql: `
        INSERT INTO orders (
          customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
          payment_method, device_type, ip_country, promo_used, promo_code,
          order_subtotal, shipping_fee, tax_amount, order_total,
          risk_score, is_fraud)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      args: [
        input.customerId,
        now,
        input.billingZip,
        input.shippingZip,
        input.shippingState,
        input.paymentMethod,
        input.deviceType,
        input.ipCountry,
        input.promoUsed,
        input.promoCode,
        subtotal,
        shippingFee,
        tax,
        total,
        0,
      ],
    });

    const rid = ins.lastInsertRowid;
    if (rid == null) throw new Error("Insert did not return row id.");
    const orderId = Number(rid);

    for (const line of resolved) {
      await tx.execute({
        sql: `
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [orderId, line.productId, line.qty, line.unitPrice, line.lineTotal],
      });
    }

    await tx.commit();
    return orderId;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function scoreAllOrders(): Promise<number> {
  const db = getDb();
  const rs = await db.execute(`
    SELECT o.order_id, o.payment_method, o.device_type, o.ip_country, o.promo_used,
           o.order_subtotal, o.shipping_fee, o.tax_amount, o.order_total,
           COALESCE(o.shipping_state, 'UNK'),
           COALESCE(c.customer_segment, 'UNK'),
           COALESCE(c.loyalty_tier, 'UNK')
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
  `);

  let n = 0;
  for (const row of rs.rows) {
    const paymentMethod = String(row[1]);
    const ipCountry = String(row[3]);
    const promoUsed = Number(row[4]);
    const orderTotal = Number(row[8]);
    const prob = heuristicProbability({
      paymentMethod,
      promoUsed,
      orderTotal,
      ipCountry,
    });
    const risk = Math.min(100, Math.max(0, prob * 100));
    await db.execute({
      sql: "UPDATE orders SET risk_score = ? WHERE order_id = ?",
      args: [risk, Number(row[0])],
    });
    n++;
  }
  return n;
}
