import assert from "node:assert/strict";
import test from "node:test";
import { buildEventAssetCsv, reportRequestSchema } from "../src/report_export.js";

test("exports approved and queued assets while omitting rejected submissions", () => {
  const input = reportRequestSchema.parse({
    event: {
      eventId: "summer-cup",
      name: "Summer Cup",
      startsAt: "2026-08-15T10:00:00.000Z",
      endsAt: "2026-08-16T10:00:00.000Z"
    },
    assets: [
      { assetId: "skin-7", playerId: "p-1", kind: "skin", title: "Gold, Blue", moderation: "approved", createdAt: "2026-08-15T10:05:00.000Z" },
      { assetId: "map-4", playerId: "p-2", kind: "map", title: "Final Arena", moderation: "pending", createdAt: "2026-08-15T10:06:00.000Z" },
      { assetId: "emote-9", playerId: "p-3", kind: "emote", title: "Wave", moderation: "rejected", createdAt: "2026-08-15T10:07:00.000Z" }
    ],
    moderationQueue: [{ assetId: "map-4", position: 3 }]
  });

  const csv = buildEventAssetCsv(input);
  assert.match(csv, /skin-7.*publishable/);
  assert.match(csv, /map-4.*in_review,3/);
  assert.doesNotMatch(csv, /emote-9/);
  assert.match(csv, /"Gold, Blue"/);
});
