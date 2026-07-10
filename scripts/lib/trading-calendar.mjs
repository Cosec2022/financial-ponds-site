import { readFile } from "node:fs/promises";

export async function loadTradingCalendar(url = new URL("../../config/a-share-trading-calendar.v2026-07.json", import.meta.url)) {
  return validateTradingCalendar(JSON.parse(await readFile(url, "utf8")));
}

export function validateTradingCalendar(calendar) {
  if (!calendar?.calendar_version || calendar.timezone !== "Asia/Shanghai") throw new Error("Invalid A-share trading calendar metadata");
  if (!calendar.covered_date_range?.start || !calendar.covered_date_range?.end) throw new Error("Trading calendar coverage is required");
  if (!Array.isArray(calendar.sessions) || !calendar.sessions.length) throw new Error("Trading calendar sessions are required");
  const sessions = [...new Set(calendar.sessions)].sort();
  if (sessions.some((date, index) => index > 0 && date <= sessions[index - 1])) throw new Error("Trading calendar sessions must be unique and ordered");
  if (sessions[0] < calendar.covered_date_range.start || sessions.at(-1) > calendar.covered_date_range.end) throw new Error("Trading calendar session outside coverage");
  return { ...calendar, sessions };
}

export function tradingSessionTarget(calendar, signalDate, horizonTradingSessions) {
  const sessions = calendar.sessions ?? [];
  const horizon = Number(horizonTradingSessions);
  if (!Number.isInteger(horizon) || horizon < 1) return unknown(calendar, signalDate, horizon, "invalid_horizon");
  if (!isCovered(calendar, signalDate)) return unknown(calendar, signalDate, horizon, "signal_date_outside_coverage");
  const signalIndex = sessions.indexOf(signalDate);
  if (signalIndex < 0) return unknown(calendar, signalDate, horizon, "signal_date_not_a_session");
  const effectiveReviewDate = sessions[signalIndex + horizon] ?? null;
  if (!effectiveReviewDate || !isCovered(calendar, effectiveReviewDate)) return unknown(calendar, signalDate, horizon, "target_outside_coverage");
  return {
    calendar_known: true,
    calendar_version: calendar.calendar_version,
    signal_date: signalDate,
    horizon_trading_sessions: horizon,
    legacy_calendar_target_date: addCalendarDays(signalDate, horizon),
    effective_review_date: effectiveReviewDate,
    calendar_unknown_reason: null
  };
}

export function addCalendarDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function isCovered(calendar, date) {
  return Boolean(date && date >= calendar.covered_date_range.start && date <= calendar.covered_date_range.end);
}

function unknown(calendar, signalDate, horizon, reason) {
  return {
    calendar_known: false,
    calendar_version: calendar.calendar_version,
    signal_date: signalDate,
    horizon_trading_sessions: horizon,
    legacy_calendar_target_date: Number.isInteger(horizon) && horizon > 0 ? addCalendarDays(signalDate, horizon) : null,
    effective_review_date: null,
    calendar_unknown_reason: reason
  };
}
