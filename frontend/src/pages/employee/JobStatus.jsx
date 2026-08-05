import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { api, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { timeAgo } from '../../data/auditActions';

const REQUEST_STATUS_BADGE = {
  pending: { label: 'Pending Verification', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Verified', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
};

const HISTORY_GROUPS = [
  { key: 'pending', label: 'Pending', emptyText: 'No pending submissions.' },
  { key: 'approved', label: 'Approved', emptyText: 'Nothing approved yet.' },
  { key: 'rejected', label: 'Rejected', emptyText: 'Nothing rejected.' },
];

export default function JobStatus() {
  const [jobs, setJobs] = useState(null);
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    api.get('/employee/dashboard').then(d => setJobs(d.assigned)).catch(() => setJobs([]));
    api.get('/admin/approvals/mine').then(rows => setRequests(rows.filter(r => r.entity_type === 'booking'))).catch(() => setRequests([]));
  }, []);

  const jobFor = (entityId) => jobs?.find(j => j.id === entityId);
  const hasPendingRequest = (jobId) => requests?.some(r => r.entity_id === jobId && r.status === 'pending');

  return (
    <AdminLayout title="Job Status" subtitle="Track your assigned jobs and the completions you've submitted for verification.">
      <h2 className="font-semibold text-lg mb-4">All Assigned Jobs</h2>
      {jobs === null ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      ) : jobs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No jobs assigned yet.</p>
      ) : (
        <div className="card overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="p-3 font-medium">Service</th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Scheduled</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const pending = hasPendingRequest(j.id);
                return (
                  <tr key={j.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium text-gray-800">{j.service_name}</td>
                    <td className="p-3 text-gray-600">{j.first_name} {j.last_name}</td>
                    <td className="p-3 text-gray-600">{j.scheduled_date} at {j.scheduled_time}</td>
                    <td className="p-3">
                      <span className={`badge ${pending ? 'bg-amber-100 text-amber-800' : statusColor(j.status)}`}>
                        {pending ? 'Pending Verification' : j.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-semibold text-lg mb-4">Submission History</h2>
      {requests === null ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      ) : requests.length === 0 ? (
        <div className="card p-10 text-center">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No completions submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {HISTORY_GROUPS.map(group => {
            const items = requests.filter(r => r.status === group.key);
            return (
              <div key={group.key}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{group.label} ({items.length})</h3>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">{group.emptyText}</p>
                ) : (
                  <div className="space-y-3">
                    {items.map(r => <RequestCard key={r.id} request={r} job={jobFor(r.entity_id)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

function RequestCard({ request: r, job }) {
  const badge = REQUEST_STATUS_BADGE[r.status] || REQUEST_STATUS_BADGE.pending;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">
            {job?.service_name || 'Job'}{job ? ` — ${job.first_name} ${job.last_name}` : ''}
          </p>
          {r.payload?.completionNotes && <p className="text-sm text-gray-600 mt-1">"{r.payload.completionNotes}"</p>}
          {r.status === 'rejected' && r.review_note && (
            <p className="text-sm text-red-600 mt-1.5">Coordinator's note: "{r.review_note}"</p>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            Submitted {timeAgo(r.created_at)}
            {r.reviewer_first_name ? ` · Reviewed by ${r.reviewer_first_name} ${r.reviewer_last_name}` : ''}
          </p>
        </div>
        <span className={`badge shrink-0 ${badge.className}`}>{badge.label}</span>
      </div>
    </div>
  );
}
