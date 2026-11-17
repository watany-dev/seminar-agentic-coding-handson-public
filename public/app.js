const seminarList = document.querySelector("#seminars");
const registrationRows = document.querySelector("#registrations");
const form = document.querySelector("#apply-form");
const notice = document.querySelector("#notice");

const yen = (amount) => `${amount.toLocaleString("ja-JP")}円`;
const dateTime = (value) =>
  new Date(value).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showNotice(message, kind) {
  notice.textContent = message;
  notice.className = kind;
  notice.hidden = false;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "エラーが発生しました。");
  return body;
}

function renderSeminars(seminars) {
  const selected = form.elements.seminarId.value;
  seminarList.replaceChildren();
  form.elements.seminarId.replaceChildren();
  for (const seminar of seminars) {
    const card = element("li", undefined, seminar.open ? "card" : "card closed");
    card.append(
      element("h3", seminar.title),
      element("p", `開催 ${dateTime(seminar.startsAt)} ／ 申込締切 ${dateTime(seminar.deadline)}`),
      element("p", `受講料 ${yen(seminar.fee)} ／ 定員 ${seminar.capacity}名`),
      element("p", `残り ${seminar.remaining} 席`, "remaining"),
      element("span", seminar.open ? "受付中" : "受付終了", "badge"),
    );
    seminarList.append(card);
    const option = element("option", seminar.title);
    option.value = seminar.id;
    form.elements.seminarId.append(option);
  }
  if (selected) form.elements.seminarId.value = selected;
}

function renderRegistrations(registrations) {
  registrationRows.replaceChildren();
  for (const registration of registrations) {
    const row = element("tr");
    const button = element("button", "キャンセル", "secondary");
    button.type = "button";
    button.addEventListener("click", () => cancel(registration));
    const action = element("td");
    action.append(button);
    row.append(
      element("td", registration.seminarTitle),
      element("td", registration.name),
      element("td", registration.email),
      element("td", registration.refundIfCancelled > 0 ? yen(registration.refundIfCancelled) : "返金なし"),
      action,
    );
    registrationRows.append(row);
  }
}

async function refresh() {
  const [seminars, registrations] = await Promise.all([api("/api/seminars"), api("/api/registrations")]);
  renderSeminars(seminars);
  renderRegistrations(registrations);
}

async function cancel(registration) {
  try {
    const result = await api(`/api/registrations/${registration.id}`, { method: "DELETE" });
    const refund = result.refund > 0 ? `${yen(result.refund)}を返金します。` : "返金はありません。";
    showNotice(`${registration.name} さんの申込をキャンセルしました。${refund}`, "success");
  } catch (error) {
    showNotice(error.message, "error");
  }
  await refresh();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  try {
    await api(`/api/seminars/${data.get("seminarId")}/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), email: data.get("email") }),
    });
    showNotice("申込を受け付けました。", "success");
    form.elements.name.value = "";
    form.elements.email.value = "";
  } catch (error) {
    showNotice(error.message, "error");
  }
  await refresh();
});

refresh().catch((error) => showNotice(error.message, "error"));
