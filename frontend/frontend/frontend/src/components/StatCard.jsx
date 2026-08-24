export default function StatCard({ icon: Icon, iconBg = "bg-navy-100", iconColor = "text-navy-700", value, label }) {
  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${iconBg}`}>
        {Icon && <Icon size={20} strokeWidth={2} className={iconColor} aria-hidden />}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
