// FastAPI returns detail as a string (simple errors) OR as an array of
// {msg, loc, ...} objects (422 validation errors). Always turn it into
// a plain string so it's safe to render in JSX.
export function getErrorMessage(err, fallback) {
  if (err?.serverColdStart) {
    return "Cannot reach the server — it may be waking up from sleep. Please wait a few seconds and try again.";
  }
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return fallback;
}

// Extra technical line shown on-screen so we don't need DevTools to debug.
export function getErrorDebug(err) {
  const status = err?.response?.status ?? "no response";
  const msg = err?.message ?? "unknown";
  return `[debug] status: ${status}, message: ${msg}`;
}
