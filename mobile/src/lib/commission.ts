import { db } from "../db.js";
import { roundMoney } from "./orderFees.js";

const SETTING_RESTAURANT = "restaurantCommissionPct";
const SETTING_CAPTAIN = "captainCommissionPct";

const DEFAULT_RESTAURANT_PCT = Number(process.env.RESTAURANT_COMMISSION_PCT) || 12;
const DEFAULT_CAPTAIN_PCT = Number(process.env.CAPTAIN_COMMISSION_PCT) || 8;
const MAX_PCT = 50;

export type CommissionRates = {
  restaurantCommissionPct: number;
  captainCommissionPct: number;
};

export type CommissionSplit = {
  gross: number;
  commission: number;
  net: number;
};

function readSetting(key: string): number | null {
  const row = db.prepare(`SELECT value FROM AppSetting WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

function writeSetting(key: string, value: number) {
  db.prepare(
    `INSERT INTO AppSetting (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')`
  ).run(key, String(value));
}

export function getCommissionRates(): CommissionRates {
  const restaurant =
    readSetting(SETTING_RESTAURANT) ?? DEFAULT_RESTAURANT_PCT;
  const captain = readSetting(SETTING_CAPTAIN) ?? DEFAULT_CAPTAIN_PCT;
  return {
    restaurantCommissionPct: clampPct(restaurant),
    captainCommissionPct: clampPct(captain),
  };
}

export function setCommissionRates(rates: CommissionRates): CommissionRates {
  const restaurantCommissionPct = clampPct(rates.restaurantCommissionPct);
  const captainCommissionPct = clampPct(rates.captainCommissionPct);
  writeSetting(SETTING_RESTAURANT, restaurantCommissionPct);
  writeSetting(SETTING_CAPTAIN, captainCommissionPct);
  return { restaurantCommissionPct, captainCommissionPct };
}

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > MAX_PCT) return MAX_PCT;
  return roundMoney(value);
}

/** عمولة المنصة من مبلغ إجمالي — يُرجع العمولة وصافي المستفيد */
export function splitCommission(gross: number, pct: number): CommissionSplit {
  const g = roundMoney(gross);
  const commission = roundMoney((g * clampPct(pct)) / 100);
  const net = roundMoney(g - commission);
  return { gross: g, commission, net };
}
