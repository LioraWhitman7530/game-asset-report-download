import { z } from "zod";

const assetSchema = z.object({
  assetId: z.string().min(1),
  playerId: z.string().min(1),
  kind: z.enum(["skin", "map", "emote"]),
  title: z.string().min(1),
  moderation: z.enum(["approved", "pending", "rejected"]),
  createdAt: z.string().datetime(),
});

export const reportRequestSchema = z.object({
  event: z.object({
    eventId: z.string().min(1),
    name: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }).refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), {
    message: "endsAt must be after startsAt",
  }),
  assets: z.array(assetSchema).max(10_000),
  moderationQueue: z.array(z.object({
    assetId: z.string().min(1),
    position: z.number().int().positive(),
  })),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildEventAssetCsv(input: ReportRequest): string {
  const queuePositions = new Map(input.moderationQueue.map((item) => [item.assetId, item.position]));
  const rows: Array<Array<string | number>> = [[
    "event_id",
    "event_name",
    "asset_id",
    "player_id",
    "asset_kind",
    "asset_title",
    "review_state",
    "queue_position",
    "created_at",
  ]];

  for (const asset of input.assets) {
    if (asset.moderation === "rejected") continue;
    const queuePosition = asset.moderation === "pending" ? queuePositions.get(asset.assetId) ?? "unqueued" : "";
    rows.push([
      input.event.eventId,
      input.event.name,
      asset.assetId,
      asset.playerId,
      asset.kind,
      asset.title,
      asset.moderation === "approved" ? "publishable" : "in_review",
      queuePosition,
      asset.createdAt,
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
