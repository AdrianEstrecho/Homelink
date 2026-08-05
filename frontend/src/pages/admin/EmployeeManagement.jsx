import UserManagementPanel from './UserManagementPanel';

export default function EmployeeManagement() {
  return (
    <UserManagementPanel
      roleTabs={[{ key: 'employee', label: 'Employees' }]}
      title="Employee Management"
      subtitle="Onboard, promote, and manage employee accounts."
    />
  );
}
