import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StaffProfileCard from '../../components/account/StaffProfileCard';

export default function EmployeeProfile() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/employee" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-6">My Profile</h1>
      <StaffProfileCard />
    </div>
  );
}
