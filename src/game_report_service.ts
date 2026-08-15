import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_storage.js";
import { buildEventAssetCsv, reportRequestSchema } from "./report_export.js";

const bucket = process.env.REPORT_BUCKET ?? "game-event-reports";
const port = Number(process.env.PORT ?? 3000);
const bucketReady = infrai.storage.bucket.create(bucket);

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new RequestError(413, "Request body exceeds 1 MB");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Request body must be valid JSON");
  }
}

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function exportReport(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = reportRequestSchema.parse(await readJson(request));
  await bucketReady;
  const csv = buildEventAssetCsv(input);
  const exportId = randomUUID();
  const key = `events/${encodeURIComponent(input.event.eventId)}/exports/${exportId}.csv`;
  const put = await infrai.storage.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 300,
    content_type: "text/csv; charset=utf-8",
    idempotency_key: `report-put-${exportId}`,
  });
  const upload = await fetch(put.url, {
    method: "PUT",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: csv,
  });
  if (!upload.ok) throw new Error("CSV upload did not complete");

  const download = await infrai.storage.object.presign(bucket, key, {
    op: "get",
    expires_seconds: 900,
    response_disposition: `attachment; filename="${input.event.eventId}-assets.csv"`,
    idempotency_key: `report-get-${exportId}`,
  });
  json(response, 201, {
    exportId,
    includedAssets: input.assets.filter((asset) => asset.moderation !== "rejected").length,
    downloadUrl: download.url,
    expiresInSeconds: 900,
  });
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/reports/event-assets") {
    json(response, 404, { error: "Route not found" });
    return;
  }
  try {
    await exportReport(request, response);
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "Invalid report request", issues: error.issues });
    } else if (error instanceof RequestError) {
      json(response, error.status, { error: error.message });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
    } else {
      json(response, 502, { error: "Report export could not be completed" });
    }
  }
});

server.listen(port, () => {
  console.log(`Game report service listening on http://localhost:${port}`);
});
