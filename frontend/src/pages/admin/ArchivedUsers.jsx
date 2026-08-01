import UserManagementPanel from './UserManagementPanel';

export default function ArchivedUsers() {
  return (
    <UserManagementPanel
      roleTabs={[
        { key: 'customer', label: 'Customers' },
        { key: 'employee', label: 'Employees' },
      ]}
      title="Archived Users"
      subtitle="Restore or permanently delete archived accounts."
      archivedView
    />
  );
}
