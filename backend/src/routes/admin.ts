import { Router } from "express";
import { z } from "zod";
import { db, cuid } from "../db.js";
import { authMiddleware } from "../lib/auth.js";
import { roundMoney } from "../lib/orderFees.js";
import {
  getCommissionRates,
  setCommissionRates,
  splitCommission,
} from "../lib/commission.js";

const router = Router();

const paidOrderFilter = `o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED')
  AND EXISTS (SELECT 1 FROM Payment p WHERE p.orderId = o.id AND p.status = 'SUCCESS')`;

const deliveredPaidFilter = `o.status = 'DELIVERED'
  AND EXISTS (SELECT 1 FROM Payment p WHERE p.orderId = o.id AND p.status = 'SUCCESS')`;

const ACTIVE_ORDER_STATUSES = [
  "PAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "CAPTAIN_ASSIGNED",
  "PICKED_UP",
  "DELIVERING",
] as const;

function getFinanceSummary() {
  const rates = getCommissionRates();

  const collected = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(o.total AS REAL)), 0) as v FROM "Order" o WHERE ${paidOrderFilter}`
    )
    .get() as { v: number };

  const deliveredRevenue = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(o.total AS REAL)), 0) as v FROM "Order" o WHERE ${deliveredPaidFilter}`
    )
    .get() as { v: number };

  const restaurantGross = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(oi.lineTotal AS REAL)), 0) as v
       FROM OrderItem oi
       JOIN "Order" o ON o.id = oi.orderId
       WHERE ${deliveredPaidFilter}`
    )
    .get() as { v: number };

  const captainGross = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(o.deliveryFee AS REAL)), 0) as v
       FROM "Order" o
       WHERE ${deliveredPaidFilter} AND o.captainId IS NOT NULL`
    )
    .get() as { v: number };

  const restaurantPaid = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as v FROM PayoutRecord WHERE type = 'RESTAURANT'`
    )
    .get() as { v: number };

  const captainPaid = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as v FROM PayoutRecord WHERE type = 'CAPTAIN'`
    )
    .get() as { v: number };

  const restSplit = splitCommission(restaurantGross.v, rates.restaurantCommissionPct);
  const capSplit = splitCommission(captainGross.v, rates.captainCommissionPct);
  const platformCommission = roundMoney(restSplit.commission + capSplit.commission);

  const collectedN = roundMoney(collected.v);
  const deliveredN = roundMoney(deliveredRevenue.v);
  const restPaidN = roundMoney(restaurantPaid.v);
  const capPaidN = roundMoney(captainPaid.v);

  return {
    ...rates,
    collected: collectedN,
    deliveredRevenue: deliveredN,
    inProgressHeld: roundMoney(collectedN - deliveredN),
    restaurantGross: restSplit.gross,
    restaurantCommission: restSplit.commission,
    restaurantNetOwed: restSplit.net,
    restaurantPaid: restPaidN,
    restaurantPending: roundMoney(restSplit.net - restPaidN),
    captainGross: capSplit.gross,
    captainCommission: capSplit.commission,
    captainNetOwed: capSplit.net,
    captainPaid: capPaidN,
    captainPending: roundMoney(capSplit.net - capPaidN),
    platformCommission,
    platformAfterPayouts: roundMoney(collectedN - restPaidN - capPaidN),
    platformHeld: roundMoney(
      platformCommission +
        roundMoney(restSplit.net - restPaidN) +
        roundMoney(capSplit.net - capPaidN) +
        roundMoney(collectedN - deliveredN)
    ),
  };
}

const commissionSchema = z.object({
  restaurantCommissionPct: z.number().min(0).max(50),
  captainCommissionPct: z.number().min(0).max(50),
});

router.get("/commission", authMiddleware(["ADMIN"]), (_req, res) => {
  res.json(getCommissionRates());
});

router.patch("/commission", authMiddleware(["ADMIN"]), (req, res) => {
  const parsed = commissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "نسب غير صالحة (0–50%)" });
    return;
  }
  const rates = setCommissionRates(parsed.data);
  res.json({ ok: true, ...rates, finance: getFinanceSummary() });
});

router.get("/overview", authMiddleware(["ADMIN"]), (_req, res) => {
  const users = db
    .prepare(
      `SELECT role, COUNT(*) as n FROM User WHERE role != 'ADMIN' GROUP BY role`
    )
    .all() as { role: string; n: number }[];

  const orderStats = db
    .prepare(
      `SELECT
         COUNT(*) as totalOrders,
         SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
       FROM "Order" o WHERE ${paidOrderFilter}`
    )
    .get() as { totalOrders: number; delivered: number };

  const counts: Record<string, number> = {};
  for (const row of users) counts[row.role] = Number(row.n);

  const activeOrders = db
    .prepare(
      `SELECT COUNT(*) as n FROM "Order" o
       WHERE o.status IN (${ACTIVE_ORDER_STATUSES.map(() => "?").join(",")})`
    )
    .get(...ACTIVE_ORDER_STATUSES) as { n: number };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const todayStats = db
    .prepare(
      `SELECT COUNT(*) as ordersToday, COALESCE(SUM(CAST(o.total AS REAL)), 0) as revenueToday
       FROM "Order" o
       WHERE ${paidOrderFilter} AND o.createdAt >= ?`
    )
    .get(todayIso) as { ordersToday: number; revenueToday: number };

  const paymentRows = db
    .prepare(
      `SELECT COALESCE(p.paymentMethod, 'UNKNOWN') as method,
              COUNT(*) as orderCount,
              COALESCE(SUM(CAST(o.total AS REAL)), 0) as totalAmount
       FROM "Order" o
       JOIN Payment p ON p.orderId = o.id AND p.status = 'SUCCESS'
       WHERE ${paidOrderFilter}
       GROUP BY p.paymentMethod`
    )
    .all() as { method: string; orderCount: number; totalAmount: number }[];

  const paymentBreakdown: Record<string, { orderCount: number; totalAmount: number }> = {};
  for (const row of paymentRows) {
    paymentBreakdown[row.method] = {
      orderCount: Number(row.orderCount) || 0,
      totalAmount: roundMoney(row.totalAmount),
    };
  }

  res.json({
    users: {
      customers: counts.CUSTOMER ?? 0,
      restaurants: counts.RESTAURANT ?? 0,
      captains: counts.CAPTAIN ?? 0,
    },
    orders: {
      paid: Number(orderStats?.totalOrders) || 0,
      delivered: Number(orderStats?.delivered) || 0,
      active: Number(activeOrders?.n) || 0,
      today: Number(todayStats?.ordersToday) || 0,
      todayRevenue: roundMoney(todayStats?.revenueToday ?? 0),
    },
    paymentBreakdown,
    finance: getFinanceSummary(),
  });
});

router.get("/orders", authMiddleware(["ADMIN"]), (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);

  let sql = `SELECT o.id, o.invoiceNumber, o.status, o.total, o.deliveryFee, o.deliveryAddress,
      o.createdAt, o.updatedAt,
      u.name as customerName, u.email as customerEmail, u.phone as customerPhone,
      p.paymentMethod,
      (SELECT u2.name FROM Captain c JOIN User u2 ON u2.id = c.userId WHERE c.id = o.captainId) as captainName,
      (SELECT GROUP_CONCAT(DISTINCT r.name) FROM OrderItem oi JOIN Restaurant r ON r.id = oi.restaurantId WHERE oi.orderId = o.id) as restaurantNames
     FROM "Order" o
     JOIN User u ON u.id = o.customerId
     LEFT JOIN Payment p ON p.orderId = o.id AND p.status = 'SUCCESS'
     WHERE 1=1`;
  const params: unknown[] = [];

  if (status && status !== "all") {
    sql += ` AND o.status = ?`;
    params.push(status);
  } else {
    sql += ` AND o.status != 'PENDING_PAYMENT'`;
  }

  sql += ` ORDER BY o.createdAt DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

  res.json({
    orders: rows.map((o) => ({
      id: o.id,
      invoiceNumber: (o.invoiceNumber as string | null) ?? null,
      status: o.status,
      total: roundMoney(o.total),
      deliveryFee: roundMoney(o.deliveryFee),
      deliveryAddress: o.deliveryAddress,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      paymentMethod: (o.paymentMethod as string | null) ?? null,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      captainName: (o.captainName as string | null) ?? null,
      restaurantNames: (o.restaurantNames as string | null) ?? null,
    })),
  });
});

router.get("/invoices", authMiddleware(["ADMIN"]), (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);

  const rows = db
    .prepare(
      `SELECT o.id, o.invoiceNumber, o.status, o.total, o.createdAt,
        u.name as customerName, u.email as customerEmail,
        p.paymentMethod, p.transactionId
       FROM "Order" o
       JOIN User u ON u.id = o.customerId
       LEFT JOIN Payment p ON p.orderId = o.id AND p.status = 'SUCCESS'
       WHERE o.invoiceNumber IS NOT NULL
       ORDER BY o.createdAt DESC
       LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];

  res.json({
    invoices: rows.map((o) => ({
      orderId: o.id,
      invoiceNumber: o.invoiceNumber,
      status: o.status,
      total: roundMoney(o.total),
      createdAt: o.createdAt,
      paymentMethod: (o.paymentMethod as string | null) ?? null,
      transactionId: (o.transactionId as string | null) ?? null,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      codPending: o.paymentMethod === "COD" && o.status !== "DELIVERED",
    })),
  });
});

router.get("/restaurants", authMiddleware(["ADMIN"]), (_req, res) => {
  const rates = getCommissionRates();
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.city, r.address, r.isActive, u.email, u.phone, u.createdAt,
        COALESCE((
          SELECT SUM(CAST(oi.lineTotal AS REAL))
          FROM OrderItem oi
          JOIN "Order" o ON o.id = oi.orderId
          WHERE oi.restaurantId = r.id AND ${deliveredPaidFilter}
        ), 0) as salesTotal,
        COALESCE((
          SELECT COUNT(DISTINCT o.id)
          FROM OrderItem oi
          JOIN "Order" o ON o.id = oi.orderId
          WHERE oi.restaurantId = r.id AND ${deliveredPaidFilter}
        ), 0) as orderCount,
        COALESCE((
          SELECT SUM(CAST(pr.amount AS REAL))
          FROM PayoutRecord pr WHERE pr.type = 'RESTAURANT' AND pr.beneficiaryId = r.id
        ), 0) as paidOut
       FROM Restaurant r
       JOIN User u ON u.id = r.userId
       ORDER BY salesTotal DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    restaurants: rows.map((r) => {
      const split = splitCommission(Number(r.salesTotal), rates.restaurantCommissionPct);
      const paidOut = roundMoney(r.paidOut);
      return {
        id: r.id,
        name: r.name,
        city: r.city,
        address: r.address,
        isActive: Boolean(r.isActive),
        email: r.email,
        phone: r.phone,
        createdAt: r.createdAt,
        orderCount: Number(r.orderCount) || 0,
        salesGross: split.gross,
        platformCommission: split.commission,
        salesNet: split.net,
        paidOut,
        pending: roundMoney(split.net - paidOut),
      };
    }),
  });
});

router.get("/captains", authMiddleware(["ADMIN"]), (_req, res) => {
  const rates = getCommissionRates();
  const rows = db
    .prepare(
      `SELECT c.id, c.vehicle, c.isOnline, c.lat, c.lng, u.name, u.email, u.phone, u.createdAt,
        COALESCE((
          SELECT COUNT(*) FROM "Order" o
          WHERE o.captainId = c.id AND o.status = 'DELIVERED'
            AND EXISTS (SELECT 1 FROM Payment p WHERE p.orderId = o.id AND p.status = 'SUCCESS')
        ), 0) as deliveredCount,
        COALESCE((
          SELECT SUM(CAST(o.deliveryFee AS REAL)) FROM "Order" o
          WHERE o.captainId = c.id AND o.status = 'DELIVERED'
            AND EXISTS (SELECT 1 FROM Payment p WHERE p.orderId = o.id AND p.status = 'SUCCESS')
        ), 0) as feesTotal,
        COALESCE((
          SELECT SUM(CAST(pr.amount AS REAL))
          FROM PayoutRecord pr WHERE pr.type = 'CAPTAIN' AND pr.beneficiaryId = c.id
        ), 0) as paidOut
       FROM Captain c
       JOIN User u ON u.id = c.userId
       ORDER BY feesTotal DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    captains: rows.map((r) => {
      const split = splitCommission(Number(r.feesTotal), rates.captainCommissionPct);
      const paidOut = roundMoney(r.paidOut);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        vehicle: r.vehicle,
        isOnline: Boolean(r.isOnline),
        hasLocation: r.lat != null && r.lng != null,
        createdAt: r.createdAt,
        deliveredCount: Number(r.deliveredCount) || 0,
        feesGross: split.gross,
        platformCommission: split.commission,
        feesNet: split.net,
        paidOut,
        pending: roundMoney(split.net - paidOut),
      };
    }),
  });
});

router.get("/customers", authMiddleware(["ADMIN"]), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.createdAt,
        COALESCE((
          SELECT COUNT(*) FROM "Order" o
          WHERE o.customerId = u.id AND ${paidOrderFilter}
        ), 0) as orderCount,
        COALESCE((
          SELECT SUM(CAST(o.total AS REAL)) FROM "Order" o
          WHERE o.customerId = u.id AND ${paidOrderFilter}
        ), 0) as spentTotal
       FROM User u
       WHERE u.role = 'CUSTOMER'
       ORDER BY spentTotal DESC`
    )
    .all() as Record<string, unknown>[];

  res.json({
    customers: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      createdAt: r.createdAt,
      orderCount: Number(r.orderCount) || 0,
      spentTotal: roundMoney(r.spentTotal),
    })),
  });
});

router.get("/payouts", authMiddleware(["ADMIN"]), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT pr.*, 
        CASE WHEN pr.type = 'RESTAURANT' THEN (SELECT name FROM Restaurant WHERE id = pr.beneficiaryId)
             WHEN pr.type = 'CAPTAIN' THEN (SELECT u.name FROM Captain c JOIN User u ON u.id = c.userId WHERE c.id = pr.beneficiaryId)
        END as beneficiaryName
       FROM PayoutRecord pr
       ORDER BY pr.createdAt DESC
       LIMIT 100`
    )
    .all();

  res.json({ payouts: rows });
});

const payoutSchema = z.object({
  type: z.enum(["RESTAURANT", "CAPTAIN"]),
  beneficiaryId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional(),
});

router.post("/payouts", authMiddleware(["ADMIN"]), (req, res) => {
  const parsed = payoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { type, beneficiaryId, amount, note } = parsed.data;

  if (type === "RESTAURANT") {
    const r = db.prepare(`SELECT id FROM Restaurant WHERE id = ?`).get(beneficiaryId);
    if (!r) {
      res.status(404).json({ error: "المطعم غير موجود" });
      return;
    }
  } else {
    const c = db.prepare(`SELECT id FROM Captain WHERE id = ?`).get(beneficiaryId);
    if (!c) {
      res.status(404).json({ error: "الكابتن غير موجود" });
      return;
    }
  }

  const id = cuid();
  db.prepare(
    `INSERT INTO PayoutRecord (id, type, beneficiaryId, amount, note, createdBy) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, type, beneficiaryId, roundMoney(amount), note ?? null, req.user!.sub);

  res.status(201).json({ ok: true, id, message: "تم تسجيل التسليم المالي" });
});

export default router;
