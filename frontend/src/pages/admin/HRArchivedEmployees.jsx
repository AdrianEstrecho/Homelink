import UserManagementPanel from './UserManagementPanel';

export default function HRArchivedEmployees() {
  return (
    <UserManagementPanel
      roleTabs={[{ key: 'employee', label: 'Employees' }]}
      title="Archived Employees"
      subtitle="Restore or request permanent deletion of archived employee accounts."
      archivedView
    />
  );
}
