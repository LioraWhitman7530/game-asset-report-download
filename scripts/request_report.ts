const response = await fetch("http://localhost:3000/reports/event-assets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: {
      eventId: "summer-cup",
      name: "Summer Cup",
      startsAt: "2026-08-15T10:00:00.000Z",
      endsAt: "2026-08-16T10:00:00.000Z",
    },
    assets: [
      { assetId: "skin-7", playerId: "p-1", kind: "skin", title: "Gold Trim", moderation: "approved", createdAt: "2026-08-15T10:05:00.000Z" },
      { assetId: "map-4", playerId: "p-2", kind: "map", title: "Final Arena", moderation: "pending", createdAt: "2026-08-15T10:06:00.000Z" },
      { assetId: "emote-9", playerId: "p-3", kind: "emote", title: "Wave", moderation: "rejected", createdAt: "2026-08-15T10:07:00.000Z" },
    ],
    moderationQueue: [{ assetId: "map-4", position: 3 }],
  }),
});

const result: unknown = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
