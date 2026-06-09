import { db, cuid } from "../db.js";

type CaptainRow = {
  id: string;
  vehicle: string | null;
  isOnline: number;
  lat: number | null;
  lng: number | null;
};

export function getOrCreateCaptain(userId: string): CaptainRow {
  const existing = db
    .prepare(`SELECT id, vehicle, isOnline, lat, lng FROM Captain WHERE userId = ?`)
    .get(userId) as CaptainRow | undefined;
  if (existing) return existing;

  const id = cuid();
  db.prepare(`INSERT INTO Captain (id, userId, isOnline) VALUES (?, ?, 1)`).run(id, userId);
  return db.prepare(`SELECT id, vehicle, isOnline, lat, lng FROM Captain WHERE id = ?`).get(id) as CaptainRow;
}
