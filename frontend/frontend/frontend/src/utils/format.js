export function groupByMonth(items, dateField, valueFn) {
  const map = new Map();
  items.forEach((it) => {
    if (!it[dateField]) return;
    const d = new Date(it[dateField]);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    const val = valueFn ? valueFn(it) : 1;
    if (!map.has(key)) map.set(key, { key, label, value: 0, sortDate: new Date(d.getFullYear(), d.getMonth(), 1) });
    map.get(key).value += val;
  });
  return [...map.values()].sort((a, b) => a.sortDate - b.sortDate).slice(-6).map(({ label, value }) => ({ month: label, value }));
}

export function groupByKey(items, keyFn, limit) {
  const map = new Map();
  items.forEach((it) => {
    const k = keyFn(it);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  const arr = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  return limit ? arr.slice(0, limit) : arr;
}

export function toCSV(rows, headers) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => esc(h.get(r))).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function isToday(d) {
  if (!d) return false;
  const a = new Date(d), b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
