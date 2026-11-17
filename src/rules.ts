// 申込・キャンセルの業務ルール。画面にもHTTPにも依存しない。
import validator from "validator";

export const CANCEL_FEE = 500;
export const REFUND_LIMIT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Seminar = {
  id: string;
  title: string;
  startsAt: Date;
  deadline: Date;
  capacity: number;
  fee: number;
};

export type Registration = {
  id: string;
  seminarId: string;
  name: string;
  email: string;
};

export type Applicant = { name: string; email: string };

export type RejectReason =
  | "name_required"
  | "invalid_email"
  | "deadline_passed"
  | "full"
  | "duplicate";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function remainingSeats(seminar: Seminar, registrations: Registration[]): number {
  return seminar.capacity - registrations.length;
}

export function isOpen(seminar: Seminar, registrations: Registration[], now: Date): boolean {
  return now.getTime() <= seminar.deadline.getTime() && remainingSeats(seminar, registrations) > 0;
}

/** 申込できない理由を返す。申込できる場合は null。registrations は対象セミナーの申込だけを渡す。 */
export function checkApplication(
  seminar: Seminar,
  registrations: Registration[],
  applicant: Applicant,
  now: Date,
): RejectReason | null {
  if (applicant.name.trim() === "") return "name_required";
  if (!validator.isEmail(applicant.email.trim())) return "invalid_email";
  if (now.getTime() > seminar.deadline.getTime()) return "deadline_passed";
  if (registrations.length > seminar.capacity) return "full";
  const email = normalizeEmail(applicant.email);
  if (registrations.some((registration) => registration.email === email)) return "duplicate";
  return null;
}

/** キャンセル時の返金額。開催7日前までは手数料を引いて返金、それ以降は返金なし。 */
export function refundAmount(seminar: Seminar, now: Date): number {
  const limit = seminar.startsAt.getTime() - REFUND_LIMIT_DAYS * DAY_MS;
  if (now.getTime() > limit) return 0;
  return Math.max(seminar.fee - CANCEL_FEE, 0);
}
