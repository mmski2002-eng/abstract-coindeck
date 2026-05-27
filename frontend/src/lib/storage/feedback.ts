import { dbQuery } from "@/lib/db/client";

export const MAX_FEEDBACK_ROWS = 100000;

export type FeedbackEntry = {
  ts: string;
  ip: string;
  rating: number | null;
  name: string | null;
  wallet: string | null;
  text: string;
};

export async function feedbackStorageFull(): Promise<boolean> {
  const result = await dbQuery<{ total: string }>("select count(*)::text as total from feedback");
  return Number(result.rows[0]?.total ?? "0") >= MAX_FEEDBACK_ROWS;
}

export async function appendFeedback(entry: FeedbackEntry): Promise<void> {
  await dbQuery(
    `insert into feedback (created_at, ip_hash, rating, name, wallet, text)
     values ($1, $2, $3, $4, $5, $6)`,
    [entry.ts, entry.ip, entry.rating, entry.name, entry.wallet, entry.text],
  );
}
