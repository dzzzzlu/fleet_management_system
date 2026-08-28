import { useEffect, useState } from "react";
import { Archive, Truck, Users, TriangleAlert } from "lucide-react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import Tabs from "../components/Tabs";
import StatCard from "../components/StatCard";
import { fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";

const EMPTY = { vehicles: [], drivers: [], incidents: [] };

export default function Archives() {
  const [data, setData] = useState(EMPTY);
  const [tab, setTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const { error, debug, handleError } = useErrorHandler();

  const load = () => {
    api.get("/archives/vehicles").then((r) => setData((d) => ({ ...d, vehicles: r.data }))).catch((e) => handleError(e, "Failed to load archived vehicles"));
    api.get("/archives/drivers").then((r) => setData((d) => ({ ...d, drivers: r.data }))).catch((e) => handleError(e, "Failed to load archived drivers"));
    api.get("/archives/incidents").then((r) => setData((d) => ({ ...d, incidents: r.data }))).catch((e) => handleError(e, "Failed to load archived incidents"));
  };
  useEffect(() => { load(); }, []);

  const q = search.toLowerCase();
  const veh = data.vehicles.filter((v) => `${v.plate_number} ${v.brand} ${v.model}`.toLowerCase().includes(q));
  const drv = data.drivers.filter((d) => `${d.full_name} ${d.employee_number}`.toLowerCase().includes(q));
  const inc = data.incidents.filter((i) => `${i.incident_type} ${i.vehicle_plate || ""}`.toLowerCase().includes(q));

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archives</h1>
          <p className="text-gray-500 text-sm">View soft-deleted records removed from the fleet (admin &amp; manager only)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Truck} iconBg="bg-navy-100" iconColor="text-navy-700" value={data.vehicles.length} label="Archived Vehicles" />
        <StatCard icon={Users} iconBg="bg-purple-100" iconColor="text-purple-700" value={data.drivers.length} label="Archived Drivers" />
        <StatCard icon={TriangleAlert} iconBg="bg-red-100" iconColor="text-red-700" value={data.incidents.length} label="Archived Incidents" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "vehicles", label: "Vehicles" },
          { value: "drivers", label: "Drivers" },
          { value: "incidents", label: "Incidents" },
        ]}
      />

      {error && (
        <div className="my-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search archived records…"
        className="w-full mb-4 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm mt-4"
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        {tab === "vehicles" && (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
              <tr>
                <th className="px-6 py-3">Plate Number</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Brand / Model</th>
                <th className="px-6 py-3">Year</th>
                <th className="px-6 py-3">Last Status</th>
                <th className="px-6 py-3">Archived</th>
              </tr>
            </thead>
            <tbody>
              {veh.length === 0 && <tr><td colSpan={6} className="text-center py-16 text-gray-400">No archived vehicles.</td></tr>}
              {veh.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium text-gray-900">{v.plate_number}</td>
                  <td className="px-6 py-4 text-gray-600">{v.vehicle_type}</td>
                  <td className="px-6 py-4 text-gray-600">{v.brand} {v.model}</td>
                  <td className="px-6 py-4 text-gray-600">{v.year || "—"}</td>
                  <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                  <td className="px-6 py-4 text-gray-500">{fmtDate(v.deleted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "drivers" && (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
              <tr>
                <th className="px-6 py-3">Employee No.</th>
                <th className="px-6 py-3">Driver Name</th>
                <th className="px-6 py-3">License No.</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Last Status</th>
                <th className="px-6 py-3">Archived</th>
              </tr>
            </thead>
            <tbody>
              {drv.length === 0 && <tr><td colSpan={6} className="text-center py-16 text-gray-400">No archived drivers.</td></tr>}
              {drv.map((d) => (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 text-gray-600">{d.employee_number}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                  <td className="px-6 py-4 text-gray-500">{d.license_number}</td>
                  <td className="px-6 py-4 text-gray-500">{d.phone || "—"}</td>
                  <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                  <td className="px-6 py-4 text-gray-500">{fmtDate(d.deleted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "incidents" && (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
              <tr>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Driver</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Archived</th>
              </tr>
            </thead>
            <tbody>
              {inc.length === 0 && <tr><td colSpan={6} className="text-center py-16 text-gray-400">No archived incidents.</td></tr>}
              {inc.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium text-gray-900">{i.vehicle_plate || "—"}</td>
                  <td className="px-6 py-4 text-gray-600">{i.driver_name || "—"}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{i.incident_type}</td>
                  <td className="px-6 py-4 text-gray-600">{fmtDate(i.incident_date)}</td>
                  <td className="px-6 py-4"><StatusBadge status={i.incident_status} /></td>
                  <td className="px-6 py-4 text-gray-500">{fmtDate(i.deleted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.vehicles.length + data.drivers.length + data.incidents.length === 0 && (
        <div className="mt-6 flex flex-col items-center text-center text-gray-400 py-10">
          <Archive size={40} strokeWidth={1.5} className="mb-3" />
          <p className="text-sm">Nothing is archived right now.</p>
          <p className="text-xs mt-1">Records archived via the Archive buttons (Admin) will appear here for Admin &amp; Manager.</p>
        </div>
      )}
    </div>
  );
}
