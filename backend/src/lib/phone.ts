import { db } from "../db.js";

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** رقم جوال مُسجّل لحساب آخر */
export function phoneUsedByOther(phone: string, excludeUserId?: string): boolean {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const row = excludeUserId
    ? db
        .prepare(`SELECT id FROM User WHERE phone = ? AND id != ?`)
        .get(normalized, excludeUserId)
    : db.prepare(`SELECT id FROM User WHERE phone = ?`).get(normalized);

  return !!row;
}
