export default function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="font-semibold text-gray-900 mb-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mb-4">{subtitle}</div>}
      {children}
    </div>
  );
}
