// Mirrors backend app/deps.py ROLE_PERMISSIONS.
// Granular per-action flags used to hide/create action buttons (UI only).
// The backend still enforces every permission; this just prevents showing
// actions a role cannot actually perform.

// Page-level route access (which routes each role may open).
export const ROLE_ROUTES = {
  viewer: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  staff: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  manager: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  administrator: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports", "/settings"],
  driver: ["/", "/trips", "/maintenance", "/incidents", "/reports"],
};

// Per-action permission matrix (same actions as backend ROLE_PERMISSIONS).
const ACTION_BY_ROLE = {
  viewer: [],
  staff: [
    "fleet.vehicle.create", "fleet.vehicle.update",
    "fleet.driver.create", "fleet.driver.update",
    "fleet.trip.create", "fleet.trip.update",
    "fleet.maintenance.create", "fleet.maintenance.update",
  ],
  manager: [
    "fleet.vehicle.create", "fleet.vehicle.update",
    "fleet.driver.create", "fleet.driver.update",
    "fleet.trip.create", "fleet.trip.update", "fleet.trip.approve",
    "fleet.maintenance.create", "fleet.maintenance.update", "fleet.maintenance.complete",
  ],
  administrator: [
    "fleet.vehicle.create", "fleet.vehicle.update", "fleet.vehicle.delete",
    "fleet.driver.create", "fleet.driver.update", "fleet.driver.delete",
    "fleet.trip.create", "fleet.trip.update", "fleet.trip.approve",
    "fleet.maintenance.create", "fleet.maintenance.update", "fleet.maintenance.complete",
  ],
  driver: [],
};

const ACTIONS = {
  vehicleCreate: "fleet.vehicle.create",
  vehicleUpdate: "fleet.vehicle.update",
  vehicleDelete: "fleet.vehicle.delete",
  driverCreate: "fleet.driver.create",
  driverUpdate: "fleet.driver.update",
  driverDelete: "fleet.driver.delete",
  tripCreate: "fleet.trip.create",
  tripUpdate: "fleet.trip.update",
  tripApprove: "fleet.trip.approve",
  maintenanceCreate: "fleet.maintenance.create",
  maintenanceUpdate: "fleet.maintenance.update",
  maintenanceComplete: "fleet.maintenance.complete",
};

export function canAccess(role, path) {
  const allowed = ROLE_ROUTES[role] || [];
  const p = path.split("?")[0];
  return allowed.includes(p);
}

export function can(role, action) {
  const actions = ACTION_BY_ROLE[role] || [];
  const target = ACTIONS[action];
  return target ? actions.includes(target) : false;
}
