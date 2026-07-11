const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function compareNullableIsoDate(left, right) {
  const leftValid = isValidIsoDate(left);
  const rightValid = isValidIsoDate(right);
  if (left !== null && !leftValid) throw new TypeError(`Expected nullable ISO date, received ${String(left)}`);
  if (right !== null && !rightValid) throw new TypeError(`Expected nullable ISO date, received ${String(right)}`);
  if (leftValid && rightValid) return left.localeCompare(right);
  if (leftValid) return -1;
  if (rightValid) return 1;
  return 0;
}

export function compareReviewDue(left, right) {
  return compareNullableIsoDate(left.date, right.date)
    || compareText(left.signal_date ?? left.candidate_as_of, right.signal_date ?? right.candidate_as_of)
    || compareText(left.pool_id, right.pool_id)
    || compareNumber(left.horizon_trading_sessions, right.horizon_trading_sessions)
    || compareText(left.horizon, right.horizon)
    || compareNumber(left.count, right.count);
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function compareNumber(left, right) {
  const leftValue = Number.isFinite(left) ? left : Number.POSITIVE_INFINITY;
  const rightValue = Number.isFinite(right) ? right : Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}
