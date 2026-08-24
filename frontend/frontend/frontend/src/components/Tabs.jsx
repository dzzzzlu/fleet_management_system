export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto bg-white rounded-lg shadow-sm p-1 mb-6">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
            active === t.value ? "bg-navy-100 text-navy-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
