export type Edge = [string, string, string];
export type PaperHighlight = { start: number; end: number; text: string };
export type RecordData = {
  highlights: PaperHighlight[];
  fields: Record<string, string>;
  edges: Record<string, Edge[]>;
  ratings: Record<string, string>;
  updated: number;
};
export function empty(): RecordData {
  return { highlights: [], fields: {}, edges: {}, ratings: {}, updated: 0 };
}
export function expiry(time: number) {
  const end = new Date(time);
  const day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + 6);
  const last = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, last));
  return end.getTime();
}
export function read(key: string): RecordData {
  const raw = localStorage.getItem(key);
  if (!raw) return empty();
  const record = JSON.parse(raw);
  if (
    !Number.isFinite(record.updated) ||
    expiry(record.updated) <= Date.now()
  ) {
    localStorage.removeItem(key);
    return empty();
  }
  if (!record.fields || !record.edges || !record.ratings)
    throw new Error("invalid record");
  record.highlights ??= [];
  return record;
}
