import { db } from "../db.js";

const SETTING_RESTAURANT = "restaurantCommissionPct";
const SETTING_CAPTAIN = "captainCommissionPct";
const DEFAULT_RESTAURANT_PCT = Number(process.env.RESTAURANT_COMMISSION_PCT) || 12;
const DEFAULT_CAPTAIN_PCT = Number(process.env.CAPTAIN_COMMISSION_PCT) || 8;
const MAX_COMMISSION_PCT = 50;

export type CommissionRates = {
  restaurantCommissionPct: number;
  captainCommissionPct: number;
};

export type CommissionSplit = {
  gross: number;
  commission: number;
  net: number;
};

/** Round to 2 decimal places for SAR amounts. */
export function roundMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Attach monetary fields from the Order row as stored at checkout.
 * Never recalculate deliveryFee from distance on read — fees are immutable after order creation.
 */
export function attachLockedOrderMoney<T extends Record<string, unknown>>(order: T) {
  return {
    ...order,
    deliveryFee: roundMoney(order.deliveryFee),
    subtotal: roundMoney(order.subtotal),
    total: roundMoney(order.total),
    deliveryLat: Number(order.deliveryLat),
    deliveryLng: Number(order.deliveryLng),
  };
}

function readCommissionSetting(key: string): number | null {
  const row = db.prepare(`SELECT value FROM AppSetting WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

function writeCommissionSetting(key: string, value: number) {
  db.prepare(
    `INSERT INTO AppSetting (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')`
  ).run(key, String(value));
}

function clampCommissionPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > MAX_COMMISSION_PCT) return MAX_COMMISSION_PCT;
  return roundMoney(value);
}

export function getCommissionRates(): CommissionRates {
  const restaurant = readCommissionSetting(SETTING_RESTAURANT) ?? DEFAULT_RESTAURANT_PCT;
  const captain = readCommissionSetting(SETTING_CAPTAIN) ?? DEFAULT_CAPTAIN_PCT;
  return {
    restaurantCommissionPct: clampCommissionPct(restaurant),
    captainCommissionPct: clampCommissionPct(captain),
  };
}

export function setCommissionRates(rates: CommissionRates): CommissionRates {
  const restaurantCommissionPct = clampCommissionPct(rates.restaurantCommissionPct);
  const captainCommissionPct = clampCommissionPct(rates.captainCommissionPct);
  writeCommissionSetting(SETTING_RESTAURANT, restaurantCommissionPct);
  writeCommissionSetting(SETTING_CAPTAIN, captainCommissionPct);
  return { restaurantCommissionPct, captainCommissionPct };
}

export function splitCommission(gross: number, pct: number): CommissionSplit {
  const g = roundMoney(gross);
  const commission = roundMoney((g * clampCommissionPct(pct)) / 100);
  const net = roundMoney(g - commission);
  return { gross: g, commission, net };
}
