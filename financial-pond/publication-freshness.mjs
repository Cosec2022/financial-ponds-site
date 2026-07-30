const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CUTOFF = "16:45";
const MARKET_TIMEZONE = "Asia/Shanghai";

export function evaluatePublicationFreshness({
  asOf,
  calendar,
  now = new Date(),
  publicationCutoff = DEFAULT_CUTOFF
}) {
  if (!DAY.test(String(asOf ?? ""))) return unknown("invalid_publication_date");
  if (
    calendar?.timezone !== MARKET_TIMEZONE
    || !DAY.test(String(calendar?.covered_date_range?.start ?? ""))
    || !DAY.test(String(calendar?.covered_date_range?.end ?? ""))
    || !Array.isArray(calendar?.sessions)
  ) return unknown("invalid_trading_calendar");

  const sessions = [...new Set(calendar.sessions)].filter((date) => DAY.test(date)).sort();
  if (!sessions.includes(asOf)) return error("publication_date_not_a_session", null);

  const marketNow = zonedParts(now, MARKET_TIMEZONE);
  if (!marketNow) return unknown("invalid_current_time");
  const currentDate = `${marketNow.year}-${marketNow.month}-${marketNow.day}`;
  if (
    currentDate < calendar.covered_date_range.start
    || currentDate > calendar.covered_date_range.end
  ) return unknown("calendar_coverage_unknown");

  const cutoffMinutes = parseCutoff(publicationCutoff);
  if (cutoffMinutes === null) return unknown("invalid_publication_cutoff");
  const todayEligible = marketNow.hour * 60 + marketNow.minute >= cutoffMinutes;
  const expectedAsOf = sessions
    .filter((date) => date < currentDate || (date === currentDate && todayEligible))
    .at(-1) ?? null;

  if (!expectedAsOf) return unknown("no_expected_session");
  if (asOf < expectedAsOf) return stale(expectedAsOf);
  if (asOf > expectedAsOf) return error("publication_date_is_future", expectedAsOf);
  return fresh(expectedAsOf);
}

function zonedParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function parseCutoff(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function fresh(expectedAsOf) {
  return {
    state: "fresh",
    expected_as_of: expectedAsOf,
    reason: null,
    label: "数据为最新"
  };
}

function stale(expectedAsOf) {
  return {
    state: "stale",
    expected_as_of: expectedAsOf,
    reason: "publication_behind_expected_session",
    label: `数据过期 · 应至 ${expectedAsOf}`
  };
}

function error(reason, expectedAsOf) {
  return {
    state: "error",
    expected_as_of: expectedAsOf,
    reason,
    label: "数据日期异常"
  };
}

function unknown(reason) {
  return {
    state: "unknown",
    expected_as_of: null,
    reason,
    label: "新鲜度未知"
  };
}
