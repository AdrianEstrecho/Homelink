import UserManagementPanel from './UserManagementPanel';

export default function ArchivedUsers() {
  return (
    <UserManagementPanel
      roleTabs={[
        { key: 'customer', label: 'Customers' },
      ]}
      title="Archived Users"
      subtitle="Restore or permanently delete archived accounts."
      archivedView
    />
  );
}
