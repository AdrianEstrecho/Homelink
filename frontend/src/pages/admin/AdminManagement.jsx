import UserManagementPanel from './UserManagementPanel';

export default function AdminManagement() {
  return (
    <UserManagementPanel
      roleTabs={[
        { key: 'employee', label: 'Employees' },
        { key: 'admin', label: 'Admins' },
      ]}
      title="Admin Management"
      subtitle="Manage employee and administrator accounts."
    />
  );
}
