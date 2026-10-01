import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Save, Plus, Check, CheckCircle2, ArrowRight, Package, CalendarPlus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../api/client';
import SafeImage from '../SafeImage';
import { Skeleton } from '../Skeleton';

const formFrom = (user) => ({
  firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', address: user?.address || '',
});

// What a complete profile has. Each hint says what the missing detail is used for, and the first
// unmet one is the line shown beside the progress bar.
const PROFILE_STEPS = [
  { key: 'name', done: (u) => !!(u?.firstName && u?.lastName), hint: 'Add your full name so it appears on your orders and bookings.' },
  { key: 'email', done: (u) => !!u?.email, hint: '' },
  { key: 'phone', done: (u) => !!u?.phone, hint: 'Add a phone number so our team can reach you about deliveries and service visits.' },
  { key: 'address', done: (u) => !!u?.address?.trim(), hint: 'Add your home address and it will be ready to pick at checkout and when you book a service.' },
  { key: 'twoFactor', done: (u) => !!u?.twoFactorEnabled, hint: 'Turn on two-step verification so a password alone can’t open your account.' },
];

export default function ProfileTab({ orders = null, bookings = null }) {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState('firstName');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => formFrom(user));

  const startEdit = (field = 'firstName') => {
    setForm(formFrom(user));
    setFocusField(field);
    setError('');
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile(form);
      setEditing(false);
      showToast({ icon: CheckCircle2, iconClass: 'bg-teal-100 text-teal-700', title: 'Profile saved' });
    } catch (err) {
      setError(err.message || 'Your changes weren’t saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-xl text-brand-ink">Profile Details</h2>
          <p className="text-sm text-gray-500 mt-1">How you appear on orders and bookings, and how our team reaches you.</p>
        </div>
        {!editing && (
          <button
            onClick={() => startEdit()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-brand-navy hover:border-brand-navy/30 hover:bg-brand-navy/[0.03] transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Profile
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="profile-first" label="First Name">
              <input id="profile-first" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" autoFocus={focusField === 'firstName'} className="input-field" required />
            </Field>
            <Field id="profile-last" label="Last Name">
              <input id="profile-last" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" className="input-field" required />
            </Field>
          </div>
          <Field id="profile-phone" label="Phone Number">
            <input id="profile-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" autoFocus={focusField === 'phone'} className="input-field" placeholder="09XXXXXXXXX" />
          </Field>
          <Field id="profile-address" label="Home Address">
            <textarea id="profile-address" value={form.address} onChange={set('address')} autoComplete="street-address" autoFocus={focusField === 'address'} rows={2} className="input-field" placeholder="House no., street, barangay, city, province" />
          </Field>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <ProfileProgress user={user} />
          <dl className="mt-2 divide-y divide-gray-100">
            <DetailRow label="Full name">{fullName || <Missing />}</DetailRow>
            <DetailRow label="Email address" action={<span className="text-xs text-gray-400">Used to sign in</span>}>
              {user?.email}
            </DetailRow>
            <DetailRow label="Phone number" action={!user?.phone && <AddButton onClick={() => startEdit('phone')}>Add phone</AddButton>}>
              {user?.phone || <Missing />}
            </DetailRow>
            <DetailRow label="Home address" action={!user?.address?.trim() && <AddButton onClick={() => startEdit('address')}>Add address</AddButton>}>
              {user?.address?.trim() || <Missing />}
            </DetailRow>
            <DetailRow
              label="Two-step verification"
              action={(
                <Link to={{ search: '?tab=security' }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:text-brand-orange transition">
                  {user?.twoFactorEnabled ? 'Manage' : 'Turn on'} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            >
              {user?.twoFactorEnabled
                ? <span className="inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />On — a code is emailed at each sign-in</span>
                : <span className="text-gray-500 font-normal">Off</span>}
            </DetailRow>
          </dl>
        </>
      )}

      <section aria-labelledby="profile-activity" className="mt-8">
        <h3 id="profile-activity" className="drafting-label text-gray-400 mb-3">Recent activity</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NextVisit bookings={bookings} />
          <LatestOrder orders={orders} />
        </div>
      </section>
    </div>
  );
}

function ProfileProgress({ user }) {
  const steps = PROFILE_STEPS.map(s => ({ ...s, ok: s.done(user) }));
  const done = steps.filter(s => s.ok).length;
  const next = steps.find(s => !s.ok);
  return (
    <div className="mt-6 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 rounded-xl border border-dashed border-gray-200 bg-brand-light/60 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3 shrink-0">
        <span className="drafting-label text-gray-500">Profile</span>
        <span className="flex gap-1" role="img" aria-label={`${done} of ${steps.length} profile steps complete`}>
          {steps.map(s => <span key={s.key} className={`h-1.5 w-5 rounded-full ${s.ok ? 'bg-brand-teal' : 'bg-gray-300/70'}`} />)}
        </span>
        <span className="text-sm font-semibold text-brand-ink tabular-nums">{done}/{steps.length}</span>
      </div>
      {next ? (
        <p className="text-sm text-gray-600 lg:border-l lg:border-gray-200 lg:pl-5">{next.hint}</p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 lg:border-l lg:border-gray-200 lg:pl-5">
          <Check className="w-4 h-4" /> Your profile is complete.
        </p>
      )}
    </div>
  );
}

function DetailRow({ label, action, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[168px_1fr_auto] sm:items-center gap-x-4 gap-y-1 py-4">
      <dt className="drafting-label text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-brand-ink min-w-0 break-words">{children}</dd>
      {action && <dd className="sm:justify-self-end">{action}</dd>}
    </div>
  );
}

function Missing() {
  return <span className="font-normal text-gray-400">Not added yet</span>;
}

function AddButton({ onClick, children }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange hover:text-orange-600 transition">
      <Plus className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5 text-gray-700">{label}</label>
      {children}
    </div>
  );
}

// ---- Recent activity -------------------------------------------------------------------------

const OPEN_BOOKING = ['pending', 'confirmed', 'in_progress'];
const BOOKING_LABEL = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In progress' };
const ORDER_LABEL = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

// scheduled_date is a bare 'YYYY-MM-DD'; pinning local midnight keeps it on the right day
// (same as Bookings.jsx).
const parseDay = (s) => {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// '14:00' -> '2:00 PM'
const formatTime = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// A job underway beats anything still ahead; otherwise the soonest open visit from today on.
function pickNextVisit(bookings) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = bookings.filter(b => OPEN_BOOKING.includes(b.status) && (b.status === 'in_progress' || (parseDay(b.scheduled_date) ?? 0) >= today));
  const live = open.find(b => b.status === 'in_progress');
  if (live) return live;
  return open.sort((a, b) => `${a.scheduled_date} ${a.scheduled_time}`.localeCompare(`${b.scheduled_date} ${b.scheduled_time}`))[0] || null;
}

// Mirrors the label My Orders shows, so the same order doesn't read two different ways.
function orderStatus(o) {
  if (o.returned && o.status !== 'cancelled') return 'Returned';
  if (o.status === 'delivered' && o.completed_at) return 'Completed';
  return ORDER_LABEL[o.status] || o.status;
}

const ACTIVITY_CARD = 'group flex rounded-xl border border-gray-200/80 bg-white overflow-hidden transition hover:border-brand-navy/25 hover:shadow-lg hover:shadow-brand-navy/5';

function NextVisit({ bookings }) {
  if (bookings === null) return <ActivitySkeleton />;
  const b = pickNextVisit(bookings);
  if (!b) {
    return (
      <EmptyActivity icon={CalendarPlus} title="No visits scheduled" to="/services" cta="Book a service">
        Your next installation or service visit will show up here.
      </EmptyActivity>
    );
  }
  const day = parseDay(b.scheduled_date);
  const tech = b.employee_first_name ? `${b.employee_first_name} ${b.employee_last_name || ''}`.trim() : null;
  return (
    <Link to="/bookings" className={ACTIVITY_CARD}>
      <div className="w-[76px] shrink-0 flex flex-col items-center justify-center py-4 bg-gradient-to-b from-brand-navy to-brand-blue text-white">
        <span className="drafting-label text-white/60">{day?.toLocaleDateString('en-US', { month: 'short' })}</span>
        <span className="font-display text-[1.75rem] font-bold leading-none my-1 tabular-nums">{day?.getDate()}</span>
        <span className="drafting-label text-white/60">{day?.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      </div>
      <div className="flex-1 min-w-0 p-4">
        <p className="drafting-label text-brand-orange">{b.status === 'in_progress' ? 'Happening now' : 'Next visit'}</p>
        <p className="mt-1 font-semibold text-brand-ink truncate">{b.service_name}</p>
        <p className="mt-0.5 text-sm text-gray-500 truncate">
          {formatTime(b.scheduled_time)} · {tech || 'Technician not assigned yet'}
        </p>
        <ActivityFooter label={BOOKING_LABEL[b.status]} />
      </div>
    </Link>
  );
}

function LatestOrder({ orders }) {
  if (orders === null) return <ActivitySkeleton />;
  const o = orders[0];
  if (!o) {
    return (
      <EmptyActivity icon={ShoppingBag} title="No orders yet" to="/products" cta="Browse products">
        Appliances you order will show up here with their delivery status.
      </EmptyActivity>
    );
  }
  const first = o.items?.[0];
  const more = (o.items?.length || 0) - 1;
  return (
    <Link to="/orders" className={ACTIVITY_CARD}>
      <div className="w-[76px] shrink-0 bg-gray-50 border-r border-gray-100 flex items-center justify-center">
        {first?.image
          ? <SafeImage src={first.image} alt="" className="w-full h-full object-contain p-2 mix-blend-multiply" iconClassName="w-6 h-6" />
          : <Package className="w-6 h-6 text-gray-300" />}
      </div>
      <div className="flex-1 min-w-0 p-4">
        <p className="drafting-label text-brand-orange">Latest order · #{o.id.slice(0, 8).toUpperCase()}</p>
        <p className="mt-1 font-semibold text-brand-ink truncate">
          {first?.name || 'Order'}
          {more > 0 && <span className="font-normal text-gray-400"> +{more} more</span>}
        </p>
        <p className="mt-0.5 text-sm text-gray-500 truncate">
          {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {formatPrice(o.total)}
        </p>
        <ActivityFooter label={orderStatus(o)} />
      </div>
    </Link>
  );
}

function ActivityFooter({ label }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="badge bg-brand-navy/[0.07] text-brand-navy">{label}</span>
      <ArrowRight className="w-4 h-4 text-gray-300 transition group-hover:text-brand-orange group-hover:translate-x-0.5" />
    </div>
  );
}

function EmptyActivity({ icon: Icon, title, to, cta, children }) {
  return (
    <div className="flex rounded-xl border border-dashed border-gray-200 overflow-hidden">
      <div className="w-[76px] shrink-0 bg-brand-light/70 flex items-center justify-center">
        <Icon className="w-6 h-6 text-brand-navy/50" />
      </div>
      <div className="flex-1 min-w-0 p-4">
        <p className="font-semibold text-brand-ink">{title}</p>
        <p className="mt-0.5 text-sm text-gray-500">{children}</p>
        <Link to={to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-orange hover:text-orange-600 transition">
          {cta} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex rounded-xl border border-gray-100 overflow-hidden">
      <Skeleton className="w-[76px] rounded-none" />
      <div className="flex-1 p-4 space-y-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}
