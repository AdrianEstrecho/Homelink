import { Boxes, ConciergeBell, CalendarClock, HardHat, UsersRound, ShieldCheck } from 'lucide-react';

// The roles offered on the staff portal's sign-in, employees first. `key` is what the
// backend checks the account against ('admin', or the employee's position). `room` is the
// role's room on the portal's floor plan (StaffFloorPlan.jsx). `access` mirrors what the
// role's sidebar shows after sign-in (POSITION_NAV_PATHS in AdminLayout.jsx) — keep the two
// in step when a position's pages change.
export const STAFF_ROLES = [
  {
    key: 'inventory_clerk',
    group: 'employee',
    title: 'Inventory Clerk',
    room: 'Stockroom',
    summary: 'Stock, catalog and returns',
    icon: Boxes,
    access: ['Dashboard', 'Products', 'Services', 'Orders', 'Returns', 'Bookings', 'Vouchers', 'Support', 'Approvals', 'Messages'],
  },
  {
    key: 'general_staff',
    group: 'employee',
    title: 'General Staff',
    room: 'Front Desk',
    summary: 'Orders, vouchers and customer support',
    icon: ConciergeBell,
    access: ['Dashboard', 'Products', 'Services', 'Orders', 'Bookings', 'Vouchers', 'Support', 'Messages'],
  },
  {
    key: 'booking_coordinator',
    group: 'employee',
    title: 'Booking Coordinator',
    room: 'Dispatch',
    summary: 'Service bookings and technician schedules',
    icon: CalendarClock,
    access: ['Dashboard', 'Bookings', 'Technicians', 'Approvals', 'Messages'],
  },
  {
    key: 'installer',
    group: 'employee',
    title: 'Installer / Technician',
    room: 'Tool Bay',
    summary: 'Your assigned jobs and completion reports',
    icon: HardHat,
    access: ['My jobs', 'Job status', 'Messages'],
  },
  {
    key: 'hr',
    group: 'employee',
    title: 'Human Resources',
    room: 'HR Office',
    summary: 'Employees, suppliers and approvals',
    icon: UsersRound,
    access: ['Dashboard', 'Employees', 'Suppliers', 'Approvals', 'Messages'],
  },
  {
    key: 'admin',
    group: 'admin',
    title: 'Administrator',
    room: 'Head Office',
    summary: 'Full access, reports and platform settings',
    icon: ShieldCheck,
    access: ['Every employee page', 'Reports', 'Users', 'Staff accounts', 'Content', 'Platform settings', 'Audit trail'],
  },
];

export function getStaffRole(key) {
  return STAFF_ROLES.find(r => r.key === key) || null;
}
