import UserManagementPanel from './UserManagementPanel';

export default function AdminUsers() {
  return (
    <UserManagementPanel
      roleTabs={[{ key: 'customer', label: 'Customers' }]}
      title="User Management"
      subtitle="View and manage customer accounts."
    />
  );
}
