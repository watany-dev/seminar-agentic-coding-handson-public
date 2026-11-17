import { describe, expect, test } from "vitest";
import { type Registration, type Seminar, checkApplication, isOpen, refundAmount, remainingSeats } from "../src/rules";

const seminar: Seminar = {
  id: "s1",
  title: "テスト用セミナー",
  startsAt: new Date("2026-11-19T15:00:00+09:00"),
  deadline: new Date("2026-11-13T16:00:00+09:00"),
  capacity: 3,
  fee: 6600,
};
const beforeDeadline = new Date("2026-11-10T12:00:00+09:00");
const applicant = { name: "山田 太郎", email: "taro@example.com" };

function registrations(count: number): Registration[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    seminarId: seminar.id,
    name: `受講者${index + 1}`,
    email: `user${index + 1}@example.com`,
  }));
}

describe("申込の受付", () => {
  test("空きがあり締切前なら受け付ける", () => {
    expect(checkApplication(seminar, registrations(0), applicant, beforeDeadline)).toBeNull();
  });

  test("名前が空なら断る", () => {
    expect(checkApplication(seminar, [], { ...applicant, name: "  " }, beforeDeadline)).toBe("name_required");
  });

  test("メールアドレスの形式が不正なら断る", () => {
    expect(checkApplication(seminar, [], { ...applicant, email: "taro@" }, beforeDeadline)).toBe("invalid_email");
  });

  test("締切時刻ちょうどは受け付け、1秒でも過ぎたら断る", () => {
    const onDeadline = new Date(seminar.deadline);
    const afterDeadline = new Date(seminar.deadline.getTime() + 1000);
    expect(checkApplication(seminar, [], applicant, onDeadline)).toBeNull();
    expect(checkApplication(seminar, [], applicant, afterDeadline)).toBe("deadline_passed");
  });

  test("定員の最後の1席は受け付ける", () => {
    expect(checkApplication(seminar, registrations(2), applicant, beforeDeadline)).toBeNull();
  });

  test("定員に達していたら断る", () => {
    expect(checkApplication(seminar, registrations(3), applicant, beforeDeadline)).toBe("full");
  });

  test("同じメールアドレスの重複申込は大文字小文字を区別せず断る", () => {
    const existing = [{ id: "r1", seminarId: seminar.id, name: "山田 太郎", email: "taro@example.com" }];
    const again = { name: "山田 太郎", email: " Taro@Example.com " };
    expect(checkApplication(seminar, existing, again, beforeDeadline)).toBe("duplicate");
  });
});

describe("残席と受付状態", () => {
  test("残席は定員から申込数を引いた数", () => {
    expect(remainingSeats(seminar, registrations(2))).toBe(1);
  });

  test("満席または締切後は受付終了", () => {
    expect(isOpen(seminar, registrations(2), beforeDeadline)).toBe(true);
    expect(isOpen(seminar, registrations(3), beforeDeadline)).toBe(false);
    expect(isOpen(seminar, [], new Date("2026-11-14T00:00:00+09:00"))).toBe(false);
  });
});

describe("キャンセル時の返金", () => {
  test("開催7日前ちょうどまでは手数料500円を引いて返金する", () => {
    expect(refundAmount(seminar, new Date("2026-11-12T15:00:00+09:00"))).toBe(6100);
  });

  test("開催7日前を過ぎたら返金しない", () => {
    expect(refundAmount(seminar, new Date("2026-11-12T15:00:01+09:00"))).toBe(0);
  });

  test("受講料が手数料より安くても返金額は負にならない", () => {
    expect(refundAmount({ ...seminar, fee: 300 }, beforeDeadline)).toBe(0);
  });
});
