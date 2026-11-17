// メモリ上のデータ置き場。サーバーを再起動すると初期データに戻る。
import { type Registration, type Seminar, normalizeEmail } from "./rules";

const DAY_MS = 24 * 60 * 60 * 1000;

export class Store {
  private nextId = 1;
  readonly seminars: Seminar[] = [];
  private registrations: Registration[] = [];

  findSeminar(id: string): Seminar | undefined {
    return this.seminars.find((seminar) => seminar.id === id);
  }

  registrationsOf(seminarId: string): Registration[] {
    return this.registrations.filter((registration) => registration.seminarId === seminarId);
  }

  allRegistrations(): Registration[] {
    return [...this.registrations];
  }

  findRegistration(id: string): Registration | undefined {
    return this.registrations.find((registration) => registration.id === id);
  }

  addRegistration(seminarId: string, name: string, email: string): Registration {
    const registration = {
      id: `r${this.nextId++}`,
      seminarId,
      name: name.trim(),
      email: normalizeEmail(email),
    };
    this.registrations.push(registration);
    return registration;
  }

  removeRegistration(id: string): void {
    this.registrations = this.registrations.filter((registration) => registration.id !== id);
  }
}

/** 画面で各ルールを試せるよう、起動時刻を基準に4つのセミナーを用意する。 */
export function createSeededStore(now: Date): Store {
  const store = new Store();
  const days = (count: number) => new Date(now.getTime() + count * DAY_MS);
  store.seminars.push(
    { id: "s1", title: "Agentic Coding 入門講座", startsAt: days(14), deadline: days(13), capacity: 30, fee: 6600 },
    { id: "s2", title: "少人数ワークショップ", startsAt: days(10), deadline: days(9), capacity: 3, fee: 12000 },
    { id: "s3", title: "直前開催セミナー", startsAt: days(3), deadline: days(2), capacity: 20, fee: 3300 },
    { id: "s4", title: "受付終了セミナー", startsAt: days(2), deadline: days(-1), capacity: 20, fee: 3300 },
  );
  store.addRegistration("s2", "佐藤 花子", "hanako@example.com");
  store.addRegistration("s2", "鈴木 一郎", "ichiro@example.com");
  store.addRegistration("s3", "高橋 次郎", "jiro@example.com");
  return store;
}
