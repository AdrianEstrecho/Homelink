import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { landingFor } from '../../utils/staffLanding';
import { STAFF_ROLES, getStaffRole } from '../../constants/staffRoles';
import StaffAuthShell from '../../components/auth/StaffAuthShell';
import { AuthField, PasswordField } from '../../components/auth/AuthField';
import CodeInput from '../../components/auth/CodeInput';
import FormAlert from '../../components/auth/FormAlert';
import ResendCode from '../../components/auth/ResendCode';
import SubmitButton from '../../components/auth/SubmitButton';
import useAuthSuccess from '../../hooks/useAuthSuccess';
import { isEmailValid } from '../../utils/validation';

const CODE_LENGTH = 8;
const EMPLOYEE_ROLES = STAFF_ROLES.filter(r => r.group === 'employee');
const ADMIN_ROLES = STAFF_ROLES.filter(r => r.group === 'admin');

// Staff sign-in. People pick their role first, then sign in to it — the chosen role rides
// along as `?role=` so the browser's Back button returns to the list, and goes to the
// backend as `portal`, which turns away an account that belongs to a different role.
export default function AdminLogin() {
  const { user, login, verifyTwoFactor, logout } = useAuth();
  const { succeeded, finish } = useAuthSuccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = getStaffRole(searchParams.get('role'));
  const roleKey = role?.key ?? null;

  const [hovered, setHovered] = useState(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [stage, setStage] = useState('credentials'); // once a role is picked: 'credentials' | '2fa'
  const [code, setCode] = useState('');
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [error, setError] = useState('');
  // Bumped on every failed attempt: replays the alert shake and flickers the lit room.
  const [errorKey, setErrorKey] = useState(0);
  // The account's actual role after a wrong-role attempt, offered as a one-click switch.
  const [switchTo, setSwitchTo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Picking a different role (here or via Back/Forward) starts its sign-in fresh.
  const [shownRole, setShownRole] = useState(roleKey);
  if (shownRole !== roleKey) {
    setShownRole(roleKey);
    setStage('credentials');
    setCode('');
    setError('');
    setSwitchTo(null);
    setHovered(null);
  }

  // Which way the step slides: deeper (list → sign in → code) slides forward, back out slides back.
  const depth = !role ? 0 : stage === '2fa' ? 2 : 1;
  const [step, setStep] = useState({ depth, dir: null });
  if (step.depth !== depth) setStep({ depth, dir: depth > step.depth ? 'forward' : 'back' });

  // Already signed in as staff: straight to their workspace — unless that sign-in just
  // happened here, in which case the success hand-off below does the navigating.
  const existingLanding = landingFor(user);
  if (existingLanding && !loading && !succeeded) return <Navigate to={existingLanding} replace />;

  const fail = (message) => {
    setError(message);
    setErrorKey(k => k + 1);
  };

  const pickRole = (key, { replace = false } = {}) => setSearchParams({ role: key }, { replace });
  const changeRole = () => setSearchParams({});

  const updateField = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setFieldErrors(fe => ({ ...fe, [field]: undefined }));
  };

  const finishLogin = (signedIn) => {
    const landing = landingFor(signedIn);
    if (!landing) {
      logout();
      throw new Error('This portal is for HomeLink staff. Customers sign in on the main site.');
    }
    finish(landing);
  };

  const signIn = async (asRole) => {
    setLoading(true);
    setError('');
    setSwitchTo(null);
    try {
      const result = await login(form.email, form.password, { portal: asRole.key });
      if (result.requires2FA) {
        setStage('2fa');
        setCode('');
        setCodeSentAt(Date.now());
        setLoading(false);
        return;
      }
      finishLogin(result.user);
    } catch (err) {
      if (err.code === 'wrong_portal') {
        const actual = getStaffRole(err.data?.portal);
        setSwitchTo(actual);
        fail(actual
          ? `This account is set up for ${actual.title}, not ${asRole.title}.`
          : `This isn't an administrator account. Pick your job under Employees instead.`);
      } else {
        fail(err.message);
      }
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = 'Enter your staff email.';
    else if (!isEmailValid(form.email)) errs.email = 'Enter a valid email, like name@homelink.com.';
    if (!form.password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setErrorKey(k => k + 1);
      return;
    }
    signIn(role);
  };

  const switchRole = () => {
    const next = switchTo;
    pickRole(next.key, { replace: true });
    signIn(next);
  };

  const verifyCode = async (value) => {
    if (loading || succeeded) return;
    if (value.length < CODE_LENGTH) {
      fail(`Enter all ${CODE_LENGTH} characters of the code.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      finishLogin(await verifyTwoFactor(form.email, value));
    } catch (err) {
      fail(err.message);
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    try {
      await login(form.email, form.password, { portal: roleKey });
      setCodeSentAt(Date.now());
    } catch (err) {
      fail(err.message);
      throw err;
    }
  };

  const plan = { activeKey: roleKey || hovered, success: succeeded, flickerKey: errorKey };

  if (!role) {
    return (
      <StaffAuthShell
        title="Choose your role"
        subtitle="Each role opens its own workspace. Pick yours, then sign in with your staff email."
        step="pick"
        stepDir={step.dir}
        status={hovered ? `Previewing ${getStaffRole(hovered).room}` : 'Choose a role'}
        plan={{ ...plan, interactive: true, onRoomHover: setHovered, onRoomSelect: pickRole }}
        footer={<>Staff accounts only. Shopping with HomeLink? <Link to="/login" className="font-semibold text-brand-navy hover:text-brand-orange">Customer sign-in</Link></>}
      >
        <RoleGroup label="Employees" roles={EMPLOYEE_ROLES} hovered={hovered} onPreview={setHovered} onPick={pickRole} />
        <RoleGroup label="Administration" roles={ADMIN_ROLES} hovered={hovered} onPreview={setHovered} onPick={pickRole} className="mt-6" />
      </StaffAuthShell>
    );
  }

  const roleTicket = <RoleTicket role={role} onChange={changeRole} disabled={loading || succeeded} />;

  if (stage === '2fa') {
    return (
      <StaffAuthShell
        title="Check your email"
        subtitle={<>Enter the {CODE_LENGTH}-character code we sent to <span className="font-semibold text-brand-ink break-all">{form.email}</span>.</>}
        top={roleTicket}
        step={`${role.key}-2fa`}
        stepDir={step.dir}
        status={succeeded ? 'Signed in' : 'Verifying code'}
        plan={plan}
      >
        <form onSubmit={(e) => { e.preventDefault(); verifyCode(code); }} noValidate className="space-y-5">
          <div>
            <p id="staff-code-label" className="text-sm font-medium text-brand-ink mb-2">Verification code</p>
            <CodeInput
              id="staff-code"
              labelledBy="staff-code-label"
              value={code}
              onChange={(next) => { setCode(next); if (error) setError(''); }}
              onComplete={verifyCode}
              invalid={Boolean(error)}
              disabled={loading || succeeded}
              autoFocus
            />
          </div>
          <ResendCode sentAt={codeSentAt} onResend={handleResendCode} />
          <FormAlert key={errorKey}>{error}</FormAlert>
          <SubmitButton loading={loading} success={succeeded} icon={ShieldCheck} loadingLabel="Verifying…" successLabel="You're in">
            Verify and sign in
          </SubmitButton>
          <button
            type="button"
            onClick={() => { setStage('credentials'); setCode(''); setError(''); }}
            className="w-full inline-flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-brand-navy"
          >
            <ChevronLeft className="w-4 h-4" /> Sign in with a different account
          </button>
        </form>
      </StaffAuthShell>
    );
  }

  return (
    <StaffAuthShell
      title="Welcome back"
      subtitle="Use the email and password for your HomeLink staff account."
      top={roleTicket}
      step={`${role.key}-credentials`}
      stepDir={step.dir}
      status={succeeded ? 'Signed in' : `${role.room} · Signing in`}
      plan={plan}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthField
          id="staff-email"
          label="Staff email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          value={form.email}
          onChange={updateField('email')}
          valid={isEmailValid(form.email)}
          error={fieldErrors.email}
        />
        <PasswordField
          id="staff-password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={updateField('password')}
          error={fieldErrors.password}
          labelAside={
            <Link to={`/admin/forgot-password?role=${role.key}`} className="text-xs font-semibold text-brand-orange hover:underline">
              Forgot password?
            </Link>
          }
        />
        <FormAlert key={errorKey} tone={switchTo ? 'warning' : 'error'}>
          {error && (
            <>
              {error}
              {switchTo && (
                <button
                  type="button"
                  onClick={switchRole}
                  disabled={loading}
                  className="mt-1.5 flex items-center gap-1 font-semibold text-brand-navy hover:text-brand-orange disabled:opacity-60"
                >
                  Sign in as {switchTo.title} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </FormAlert>
        <SubmitButton loading={loading} success={succeeded} icon={ArrowRight} loadingLabel="Signing in…" successLabel="You're in">
          Sign in
        </SubmitButton>
      </form>
    </StaffAuthShell>
  );
}

function RoleGroup({ label, roles, hovered, onPreview, onPick, className = '' }) {
  return (
    <section className={className} aria-labelledby={`staff-roles-${label}`}>
      <div className="flex items-center gap-3 mb-2.5">
        <h2 id={`staff-roles-${label}`} className="drafting text-[11px] text-gray-500">{label}</h2>
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <ul className="space-y-2">
        {roles.map(role => {
          const Icon = role.icon;
          return (
            <li key={role.key}>
              <button
                type="button"
                onClick={() => onPick(role.key)}
                onMouseEnter={() => onPreview(role.key)}
                onMouseLeave={() => onPreview(null)}
                onFocus={() => onPreview(role.key)}
                onBlur={() => onPreview(null)}
                data-preview={hovered === role.key}
                className="group w-full flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-left transition-all duration-200 hover:border-brand-navy/25 hover:shadow-[0_8px_24px_-14px_rgba(15,43,91,0.4)] data-[preview=true]:border-brand-navy/25 data-[preview=true]:shadow-[0_8px_24px_-14px_rgba(15,43,91,0.4)]"
              >
                <span className="w-10 h-10 shrink-0 rounded-lg bg-brand-navy/[0.06] text-brand-navy flex items-center justify-center transition-colors duration-200 group-data-[preview=true]:bg-brand-navy group-data-[preview=true]:text-white">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-brand-ink leading-snug">{role.title}</span>
                  <span className="block text-sm text-gray-500 leading-snug mt-0.5">{role.summary}</span>
                </span>
                <ArrowRight className="w-4 h-4 shrink-0 text-gray-300 transition-all duration-200 group-data-[preview=true]:text-brand-orange group-data-[preview=true]:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RoleTicket({ role, onChange, disabled }) {
  const Icon = role.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 pl-2.5 pr-2 py-2.5 mb-7">
      <span className="w-10 h-10 shrink-0 rounded-lg bg-brand-navy text-white flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs text-gray-500">Signing in as</span>
        <span className="block font-semibold text-brand-ink truncate">{role.title}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-navy hover:bg-white hover:text-brand-orange transition disabled:opacity-50"
      >
        Change
      </button>
    </div>
  );
}
