import UserManagementPanel from './UserManagementPanel';

export default function AdminManagement() {
  return (
    <UserManagementPanel
      roleTabs={[
        { key: 'admin', label: 'Admins' },
      ]}
      title="Admin Management"
      subtitle="Manage administrator accounts."
    />
  );
}
