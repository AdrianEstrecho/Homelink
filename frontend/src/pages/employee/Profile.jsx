import AdminLayout from '../../components/AdminLayout';
import StaffProfileCard from '../../components/account/StaffProfileCard';

export default function EmployeeProfile() {
  return (
    <AdminLayout title="My Profile" subtitle="View and manage your own account details.">
      <StaffProfileCard />
    </AdminLayout>
  );
}
