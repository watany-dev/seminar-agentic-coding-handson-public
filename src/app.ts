// HTTPの入口。/api 以下がJSON API、それ以外は public/ の画面を返す。
import { readFile } from "node:fs/promises";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { type RejectReason, checkApplication, isOpen, refundAmount, remainingSeats } from "./rules";
import type { Store } from "./store";

const MAX_BODY_BYTES = 10_000;
const PUBLIC_DIR = new URL("../public/", import.meta.url);
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};
const REJECT_STATUS: Record<RejectReason, number> = {
  name_required: 400,
  invalid_email: 400,
  deadline_passed: 409,
  full: 409,
  duplicate: 409,
};
const REJECT_MESSAGE: Record<RejectReason, string> = {
  name_required: "お名前を入力してください。",
  invalid_email: "メールアドレスの形式が正しくありません。",
  deadline_passed: "申込締切を過ぎています。",
  full: "満席のため申し込めません。",
  duplicate: "このメールアドレスは申込済みです。",
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function createApp(store: Store, clock: () => Date = () => new Date()): Server {
  async function handleApi(request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
    const now = clock();
    const route = `${request.method} ${path}`;

    if (route === "GET /api/seminars") {
      const seminars = store.seminars.map((seminar) => {
        const registrations = store.registrationsOf(seminar.id);
        return {
          ...seminar,
          remaining: remainingSeats(seminar, registrations),
          open: isOpen(seminar, registrations, now),
        };
      });
      return sendJson(response, 200, seminars);
    }

    if (route === "GET /api/registrations") {
      const registrations = store.allRegistrations().map((registration) => {
        const seminar = store.findSeminar(registration.seminarId);
        return {
          ...registration,
          seminarTitle: seminar?.title ?? "",
          refundIfCancelled: seminar ? refundAmount(seminar, now) : 0,
        };
      });
      return sendJson(response, 200, registrations);
    }

    const apply = path.match(/^\/api\/seminars\/([\w-]+)\/registrations$/);
    if (apply && request.method === "POST") {
      const seminar = store.findSeminar(apply[1]);
      if (!seminar) return sendJson(response, 404, { message: "セミナーが見つかりません。" });
      let body: unknown;
      try {
        body = await readJson(request);
      } catch {
        return sendJson(response, 400, { message: "リクエストの形式が正しくありません。" });
      }
      const input = (body ?? {}) as Record<string, unknown>;
      const applicant = { name: asText(input.name), email: asText(input.email) };
      const reason = checkApplication(seminar, store.registrationsOf(seminar.id), applicant, now);
      if (reason) return sendJson(response, REJECT_STATUS[reason], { reason, message: REJECT_MESSAGE[reason] });
      const registration = store.addRegistration(seminar.id, applicant.name, applicant.email);
      return sendJson(response, 201, registration);
    }

    const cancel = path.match(/^\/api\/registrations\/([\w-]+)$/);
    if (cancel && request.method === "DELETE") {
      const registration = store.findRegistration(cancel[1]);
      const seminar = registration && store.findSeminar(registration.seminarId);
      if (!registration || !seminar) return sendJson(response, 404, { message: "申込が見つかりません。" });
      const refund = refundAmount(seminar, now);
      store.removeRegistration(registration.id);
      return sendJson(response, 200, { refund });
    }

    return sendJson(response, 404, { message: "見つかりません。" });
  }

  return createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    try {
      if (path.startsWith("/api/")) return await handleApi(request, response, path);
      const asset = request.method === "GET" ? STATIC_FILES[path] : undefined;
      if (!asset) return sendJson(response, 404, { message: "見つかりません。" });
      const content = await readFile(new URL(asset.file, PUBLIC_DIR));
      response.writeHead(200, { "content-type": asset.type });
      response.end(content);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { message: "サーバーでエラーが発生しました。" });
    }
  });
}
