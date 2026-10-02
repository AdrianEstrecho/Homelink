import { Link } from 'react-router-dom';
import { Home as HomeIcon, ArrowLeft } from 'lucide-react';
import { getStaffRole } from '../../constants/staffRoles';
import StaffFloorPlan from './StaffFloorPlan';

// The staff sign-in and password-reset pages' layout: the form column on the left, and on
// large screens HomeLink's HQ floor plan on the right (on smaller ones it shrinks to a
// banner above the form, once a role is picked). `plan` goes straight to StaffFloorPlan;
// its `activeKey` also picks what the caption over the plan describes. `status` fills the
// drawing's title block.
// `step` keys the column's content — change it to slide the next step in, with `stepDir`
// 'forward' or 'back' (the first step just rises in).
export default function StaffAuthShell({ title, subtitle, top, step, stepDir, plan = {}, status, footer, children }) {
  const role = getStaffRole(plan.activeKey);
  const stepClass = stepDir === 'back' ? 'auth-step-back' : stepDir === 'forward' ? 'auth-step-forward' : 'auth-rise';

  return (
    // overflow-x-clip (not -hidden) contains the sideways step slide without turning this
    // into a scroll container, which would break the sticky plan panel.
    <div className="min-h-screen flex bg-white overflow-x-clip">
      <div className="w-full lg:w-1/2 flex flex-col px-4 sm:px-12 lg:px-16 py-6 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2.5 group w-fit">
            <span className="w-9 h-9 bg-brand-orange rounded-lg flex items-center justify-center group-hover:scale-105 transition">
              <HomeIcon className="w-5 h-5 text-white" />
            </span>
            <span className="font-display font-extrabold text-xl tracking-tight text-brand-navy">
              Home<span className="text-brand-orange">Link</span>
            </span>
            <span className="drafting text-[10px] text-brand-navy/70 border border-brand-navy/20 rounded px-1.5 py-0.5">Staff</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy transition">
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </header>

        <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8 sm:py-10">
          {/* Only once there's a room to show lit — on the role list it would just push the roles down. */}
          {plan.activeKey && (
            <div className="lg:hidden blueprint relative h-32 sm:h-40 rounded-2xl mb-7 overflow-hidden">
              <StaffFloorPlan {...plan} interactive={false} compact className="absolute inset-0 w-full h-full p-2.5" />
            </div>
          )}
          <div key={step} className={stepClass}>
            {top}
            <div className="mb-7">
              <h1 className="font-display text-3xl sm:text-[2.1rem] font-extrabold tracking-tight text-brand-ink">{title}</h1>
              {subtitle && <p className="text-gray-500 mt-2 leading-relaxed">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>

        {footer && <footer className="max-w-md mx-auto w-full text-xs text-gray-500">{footer}</footer>}
      </div>

      <aside className="hidden lg:block lg:w-1/2 lg:sticky lg:top-0 lg:h-screen p-4">
        <div className="blueprint relative h-full rounded-[28px] overflow-hidden flex flex-col text-white">
          <PlanCaption role={role} success={plan.success} />
          <div className="flex-1 min-h-0 px-8 xl:px-12 flex items-center justify-center">
            <StaffFloorPlan {...plan} className="w-full h-full max-w-[680px]" />
          </div>
          <div className="px-10 xl:px-12 pb-8 pt-4 flex justify-end">
            <TitleBlock status={status} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function PlanCaption({ role, success }) {
  // Fixed height so the plan below doesn't jump as the access list wraps differently per
  // role. Keyed so it crossfades as the previewed role changes.
  return (
    <div key={`${role?.key || 'none'}-${Boolean(success)}`} className="plan-caption-in h-[17rem] shrink-0 p-10 xl:p-12">
      {role ? (
        <>
          <p className="drafting text-xs text-brand-orange">{role.room}</p>
          <p className="mt-3 font-display text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.1]">
            {success ? "You're signed in." : role.title}
          </p>
          {success ? (
            <p className="mt-4 text-white/70">Opening your workspace…</p>
          ) : (
            <>
              <p className="drafting mt-5 text-[11px] text-[#9db8e6]">Opens after sign-in</p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5 max-w-lg">
                {role.access.map(page => (
                  <li key={page} className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-xs text-white/85">{page}</li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          <p className="drafting text-xs text-[#9db8e6]">HomeLink staff HQ</p>
          <p className="mt-3 font-display text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.1] max-w-md text-balance">
            Every role has its own room.
          </p>
          <p className="mt-4 max-w-sm text-white/70 leading-relaxed">Point at a role to see the pages it opens once you're signed in.</p>
        </>
      )}
    </div>
  );
}

function TitleBlock({ status }) {
  return (
    <dl className="drafting grid grid-cols-[auto_auto] text-[10px] text-[#c9d8f2] border border-[#9db8e6]/40">
      <div className="px-3.5 py-2 border-r border-[#9db8e6]/40">
        <dt className="text-[#9db8e6]/70">Drawing</dt>
        <dd className="mt-0.5">Staff HQ · Ground floor</dd>
      </div>
      <div className="px-3.5 py-2 min-w-[9.5rem]">
        <dt className="text-[#9db8e6]/70">Status</dt>
        <dd className="mt-0.5 text-white">{status}</dd>
      </div>
    </dl>
  );
}
