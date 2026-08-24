// mirrors backend app/deps.py ROLE_PERMISSIONS, kept simple as page-level access
export const ROLE_ROUTES = {
  viewer: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  staff: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  manager: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports"],
  administrator: ["/", "/vehicles", "/drivers", "/trips", "/maintenance", "/incidents", "/reports", "/settings"],
  driver: ["/", "/trips", "/maintenance", "/incidents"],
};

export function canAccess(role, path) {
  const allowed = ROLE_ROUTES[role] || [];
  return allowed.includes(path);
}
