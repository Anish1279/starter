// In-memory database for the Field Force Tracker
// This simulates the data from seed.sql

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'employee' | 'manager';
  manager_id: number | null;
}

export interface Client {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface EmployeeClient {
  id: number;
  employee_id: number;
  client_id: number;
  assigned_date: string;
}

export interface Checkin {
  id: number;
  employee_id: number;
  client_id: number;
  checkin_time: string;
  checkout_time: string | null;
  latitude: string;
  longitude: string;
  distance_from_client: number | null;
  notes: string | null;
  status: 'checked_in' | 'checked_out';
}

// Initialize with seed data
const users: User[] = [
  { id: 1, name: 'Amit Sharma', email: 'manager@unolo.com', password: 'password123', role: 'manager', manager_id: null },
  { id: 2, name: 'Rahul Kumar', email: 'rahul@unolo.com', password: 'password123', role: 'employee', manager_id: 1 },
  { id: 3, name: 'Priya Singh', email: 'priya@unolo.com', password: 'password123', role: 'employee', manager_id: 1 },
  { id: 4, name: 'Vikram Patel', email: 'vikram@unolo.com', password: 'password123', role: 'employee', manager_id: 1 },
];

const clients: Client[] = [
  { id: 1, name: 'ABC Corp', address: 'Cyber City, Gurugram', latitude: 28.4946, longitude: 77.0887 },
  { id: 2, name: 'XYZ Ltd', address: 'Sector 44, Gurugram', latitude: 28.4595, longitude: 77.0266 },
  { id: 3, name: 'Tech Solutions', address: 'DLF Phase 3, Gurugram', latitude: 28.4947, longitude: 77.0952 },
  { id: 4, name: 'Global Services', address: 'Udyog Vihar, Gurugram', latitude: 28.5011, longitude: 77.0838 },
  { id: 5, name: 'Innovate Inc', address: 'Sector 18, Noida', latitude: 28.5707, longitude: 77.3219 },
];

const employeeClients: EmployeeClient[] = [
  { id: 1, employee_id: 2, client_id: 1, assigned_date: '2024-01-01' },
  { id: 2, employee_id: 2, client_id: 2, assigned_date: '2024-01-01' },
  { id: 3, employee_id: 2, client_id: 3, assigned_date: '2024-01-15' },
  { id: 4, employee_id: 3, client_id: 2, assigned_date: '2024-01-01' },
  { id: 5, employee_id: 3, client_id: 4, assigned_date: '2024-01-01' },
  { id: 6, employee_id: 4, client_id: 1, assigned_date: '2024-01-10' },
  { id: 7, employee_id: 4, client_id: 5, assigned_date: '2024-01-10' },
];

const checkins: Checkin[] = [
  { id: 1, employee_id: 2, client_id: 1, checkin_time: '2024-01-15T09:15:00', checkout_time: '2024-01-15T11:30:00', latitude: '28.4946', longitude: '77.0887', distance_from_client: 0.05, notes: 'Regular visit', status: 'checked_out' },
  { id: 2, employee_id: 2, client_id: 2, checkin_time: '2024-01-15T12:00:00', checkout_time: '2024-01-15T14:00:00', latitude: '28.4595', longitude: '77.0266', distance_from_client: 0.02, notes: 'Product demo', status: 'checked_out' },
  { id: 3, employee_id: 2, client_id: 3, checkin_time: '2024-01-15T15:00:00', checkout_time: '2024-01-15T17:30:00', latitude: '28.4947', longitude: '77.0952', distance_from_client: 0.03, notes: 'Follow up meeting', status: 'checked_out' },
  { id: 4, employee_id: 3, client_id: 2, checkin_time: '2024-01-15T09:30:00', checkout_time: '2024-01-15T12:00:00', latitude: '28.4595', longitude: '77.0266', distance_from_client: 0.01, notes: 'Contract discussion', status: 'checked_out' },
  { id: 5, employee_id: 3, client_id: 4, checkin_time: '2024-01-15T13:00:00', checkout_time: '2024-01-15T16:00:00', latitude: '28.5011', longitude: '77.0838', distance_from_client: 0.04, notes: 'New requirements', status: 'checked_out' },
];

// Database operations
export const db = {
  users: {
    findByEmail: (email: string) => users.find(u => u.email === email),
    findById: (id: number) => users.find(u => u.id === id),
    findByManagerId: (managerId: number) => users.filter(u => u.manager_id === managerId),
    getAll: () => users,
  },
  
  clients: {
    findById: (id: number) => clients.find(c => c.id === id),
    getAll: () => [...clients],
    getByEmployeeId: (employeeId: number) => {
      const clientIds = employeeClients
        .filter(ec => ec.employee_id === employeeId)
        .map(ec => ec.client_id);
      return clients.filter(c => clientIds.includes(c.id));
    },
    create: (client: Omit<Client, 'id'>) => {
      const newClient = { ...client, id: clients.length + 1 };
      clients.push(newClient);
      return newClient;
    },
  },
  
  employeeClients: {
    isAssigned: (employeeId: number, clientId: number) => 
      employeeClients.some(ec => ec.employee_id === employeeId && ec.client_id === clientId),
    assign: (employeeId: number, clientId: number) => {
      const newAssignment = {
        id: employeeClients.length + 1,
        employee_id: employeeId,
        client_id: clientId,
        assigned_date: new Date().toISOString().split('T')[0],
      };
      employeeClients.push(newAssignment);
      return newAssignment;
    },
    getByEmployeeId: (employeeId: number) => 
      employeeClients.filter(ec => ec.employee_id === employeeId),
  },
  
  checkins: {
    getAll: () => [...checkins],
    findById: (id: number) => checkins.find(c => c.id === id),
    getByEmployeeId: (employeeId: number) => checkins.filter(c => c.employee_id === employeeId),
    getActiveByEmployeeId: (employeeId: number) => 
      checkins.find(c => c.employee_id === employeeId && c.status === 'checked_in'),
    getByDateRange: (employeeId: number, startDate?: string, endDate?: string) => {
      return checkins.filter(c => {
        if (c.employee_id !== employeeId) return false;
        const checkinDate = c.checkin_time.split('T')[0];
        if (startDate && checkinDate < startDate) return false;
        if (endDate && checkinDate > endDate) return false;
        return true;
      });
    },
    getTodayByManagerId: (managerId: number) => {
      const today = new Date().toISOString().split('T')[0];
      const teamMemberIds = users.filter(u => u.manager_id === managerId).map(u => u.id);
      return checkins.filter(c => {
        const checkinDate = c.checkin_time.split('T')[0];
        return teamMemberIds.includes(c.employee_id) && checkinDate === today;
      });
    },
    getActiveCountByManagerId: (managerId: number) => {
      const teamMemberIds = users.filter(u => u.manager_id === managerId).map(u => u.id);
      return checkins.filter(c => 
        teamMemberIds.includes(c.employee_id) && c.status === 'checked_in'
      ).length;
    },
    getWeekStatsByEmployeeId: (employeeId: number) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekCheckins = checkins.filter(c => {
        if (c.employee_id !== employeeId) return false;
        return new Date(c.checkin_time) >= weekAgo;
      });
      const uniqueClients = new Set(weekCheckins.map(c => c.client_id));
      return {
        total_checkins: weekCheckins.length,
        unique_clients: uniqueClients.size,
      };
    },
    create: (checkin: Omit<Checkin, 'id'>) => {
      const newCheckin = { ...checkin, id: checkins.length + 1 };
      checkins.push(newCheckin);
      return newCheckin;
    },
    checkout: (checkinId: number) => {
      const checkin = checkins.find(c => c.id === checkinId);
      if (checkin) {
        checkin.checkout_time = new Date().toISOString();
        checkin.status = 'checked_out';
        return checkin;
      }
      return null;
    },
    getWithDetails: (checkinList: Checkin[]) => {
      return checkinList.map(c => ({
        ...c,
        employee_name: users.find(u => u.id === c.employee_id)?.name || 'Unknown',
        client_name: clients.find(cl => cl.id === c.client_id)?.name || 'Unknown',
        client_address: clients.find(cl => cl.id === c.client_id)?.address || 'Unknown',
      }));
    },
  },
};

// Haversine formula to calculate distance between two geographic coordinates
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
