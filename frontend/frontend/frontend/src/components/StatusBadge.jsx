const COLORS = {
  available: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  assigned: "bg-navy-100 text-navy-800",
  in_progress: "bg-navy-100 text-navy-800",
  scheduled: "bg-gray-100 text-gray-600",
  maintenance: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  inactive: "bg-gray-100 text-gray-600",
  retired: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  reported: "bg-red-100 text-red-700",
  under_review: "bg-amber-100 text-amber-700",
  resolved: "bg-blue-100 text-blue-700",
  closed: "bg-green-100 text-green-700",
};

export default function StatusBadge({ status }) {
  const cls = COLORS[status] || "bg-gray-100 text-gray-600";
  const label = status?.replace("_", " ");
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}
