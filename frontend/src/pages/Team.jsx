import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, Github, LayoutDashboard, Linkedin, Mail, Server, ShoppingBag, Smartphone, Users, Wrench, X } from 'lucide-react';
import Reveal from '../components/Reveal';
import Modal, { ModalBody, ModalTitle, modalButton } from '../components/Modal';
import MemberCard from '../components/team/MemberCard';
import MemberAvatar from '../components/team/MemberAvatar';
import { TEAM, fullNameOf } from '../data/team';

// The role filter only shows once members actually have different roles.
const ROLES = [...new Set(TEAM.map(m => m.role))];

// What the team shipped, pointing at the real thing wherever there's a public page for it.
const BUILT = [
  { icon: ShoppingBag, title: 'Storefront', desc: 'Browse and buy home-improvement products, from air conditioners and solar panels to CCTV and smart home devices.', to: '/products', cta: 'Shop products' },
  { icon: Wrench, title: 'Service booking', desc: 'Book verified technicians for installation, maintenance, and repairs, then track the job from schedule to completion.', to: '/services', cta: 'Book a service' },
  { icon: Smartphone, title: 'Mobile app', desc: 'A companion app built with Angular and Capacitor, packaged for Android and deployed for the web.', href: 'https://homelink-mobile-app.vercel.app', cta: 'Open the app' },
  { icon: LayoutDashboard, title: 'Staff portal', desc: 'Role-based dashboards for administrators, inventory clerks, booking coordinators, HR, and installers.' },
  { icon: Server, title: 'API & database', desc: 'A Node.js and Express API on PostgreSQL, with PayMongo payments, Resend email, and Google sign-in.' },
  { icon: Bot, title: 'AI assistant', desc: 'A Gemini-powered shopping assistant that recommends products and services for a customer’s budget.' },
];

const STACK = ['React', 'Vite', 'Tailwind CSS', 'Node.js', 'Express', 'PostgreSQL', 'Supabase', 'Angular', 'Capacitor', 'PayMongo', 'Resend', 'Google Maps', 'Gemini'];

export default function Team() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState('');
  const shown = role ? TEAM.filter(m => m.role === role) : TEAM;

  // The open profile lives in the URL (?member=<slug>), so a teammate's profile can be linked to
  // directly — the avatars on the About page do exactly that. Replaced rather than pushed, so
  // stepping through profiles doesn't leave a trail of history entries for Back to wade through.
  const active = TEAM.find(m => m.slug === searchParams.get('member')) || null;
  const openMember = (slug) => setSearchParams({ member: slug }, { replace: true });
  const closeMember = () => setSearchParams({}, { replace: true });

  return (
    <div>
      {/* Header */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="eyebrow justify-center mb-4"><Users className="w-3.5 h-3.5" /> Meet the Team</p>
          <h1 className="section-title mb-4">The people behind HomeLink</h1>
          <p className="text-gray-500 leading-relaxed">
            From the storefront and service booking to the staff portal, the API, and the mobile app,
            HomeLink was designed and built by this team of developers.
          </p>
        </div>
      </section>

      {/* Members */}
      <section className="relative overflow-hidden py-16 md:py-20 bg-gradient-to-br from-brand-navy to-brand-blue">
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none" aria-hidden="true">
          <div className="float-blob absolute -top-24 left-1/4 w-96 h-96 bg-brand-orange rounded-full blur-3xl" />
          <div className="float-blob-delayed absolute -bottom-32 right-1/4 w-96 h-96 bg-brand-teal rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
            <div>
              <p className="eyebrow mb-3">The Developers</p>
              <h2 className="section-title text-white">{TEAM.length} developers, one platform</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Select anyone to open their profile, then browse the rest of the team from there.
            </p>
          </Reveal>

          {ROLES.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-8" role="group" aria-label="Filter by role">
              {['', ...ROLES].map(r => (
                <button
                  key={r || 'all'}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                    role === r ? 'bg-white text-brand-navy border-white' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'
                  }`}
                >
                  {r || 'Everyone'}
                </button>
              ))}
            </div>
          )}

          {/* Flex rather than grid so an incomplete last row sits centered. */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
            {shown.map((m, i) => (
              <Reveal key={m.slug} delay={i * 80} className="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.834rem)] lg:w-[calc(20%-1rem)]">
                <MemberCard member={m} index={TEAM.indexOf(m)} onOpen={() => openMember(m.slug)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What we built */}
      <section className="py-16 md:py-20 bg-brand-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-xl mx-auto mb-12">
            <p className="eyebrow justify-center mb-3">Our Work</p>
            <h2 className="section-title mb-2">What we built together</h2>
            <p className="text-gray-500">One platform for buying home-improvement products and booking the people who install them, plus everything that keeps it running.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUILT.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 80} className="h-full">
                <BuiltTile item={b} />
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-4">Built with</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {STACK.map(s => (
                <li key={s} className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-600">{s}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {active && (
        <ProfileDialog
          member={active}
          list={shown.includes(active) ? shown : TEAM}
          onNavigate={openMember}
          onClose={closeMember}
        />
      )}
    </div>
  );
}

function BuiltTile({ item }) {
  const external = Boolean(item.href);
  const body = (
    <>
      <div className="w-11 h-11 rounded-xl bg-brand-navy/5 flex items-center justify-center mb-4">
        <item.icon className="w-5 h-5 text-brand-orange" />
      </div>
      <h3 className="font-display font-bold text-brand-ink mb-2">{item.title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
      {item.cta && (
        <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange">
          {item.cta}
          {external
            ? <ArrowUpRight className="w-4 h-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            : <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />}
        </span>
      )}
    </>
  );

  const linkClass = 'card group h-full p-6 flex flex-col hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(15,43,91,0.25)]';
  if (item.to) return <Link to={item.to} className={linkClass}>{body}</Link>;
  if (external) return <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{body}</a>;
  return <div className="card h-full p-6 flex flex-col">{body}</div>;
}

function ProfileDialog({ member, list, onNavigate, onClose }) {
  const at = list.indexOf(member);
  const prev = list[(at - 1 + list.length) % list.length];
  const next = list[(at + 1) % list.length];
  const multiple = list.length > 1;

  const links = [
    member.links?.github && { href: member.links.github, label: 'GitHub', icon: Github },
    member.links?.linkedin && { href: member.links.linkedin, label: 'LinkedIn', icon: Linkedin },
    member.links?.email && { href: `mailto:${member.links.email}`, label: member.links.email, icon: Mail },
  ].filter(Boolean);

  // ← / → step through the team while the dialog is open; Modal already owns Escape and Tab.
  useEffect(() => {
    if (!multiple) return undefined;
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') onNavigate(prev.slug);
      else if (e.key === 'ArrowRight') onNavigate(next.slug);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [multiple, prev, next, onNavigate]);

  return (
    <Modal onClose={onClose} size="lg">
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-navy to-brand-blue px-5 sm:px-6 py-6 text-white">
        <div aria-hidden="true" className="account-hero-grid absolute inset-0 pointer-events-none" />
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl opacity-40 transition-colors duration-500"
          style={{ backgroundColor: member.color }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
        {/* Keyed so the entrance replays as you step from one teammate to the next. */}
        <div key={member.slug} className="fade-up relative flex items-center gap-4 sm:gap-5 pr-8">
          <MemberAvatar member={member} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-xl shadow-black/25 shrink-0" textClassName="text-2xl sm:text-3xl" />
          <div className="min-w-0">
            {multiple && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50 tabular-nums">
                {String(at + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
              </p>
            )}
            <ModalTitle className="font-display text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight mt-1">{fullNameOf(member)}</ModalTitle>
            <span className="badge bg-white/15 text-white mt-2.5">{member.role}</span>
          </div>
        </div>
      </div>

      <ModalBody>
        <div key={member.slug} className="fade-up space-y-6">
          <p className="text-gray-600 leading-relaxed">
            {member.bio || `${member.firstName} is part of the development team behind HomeLink.`}
          </p>

          {member.contributions?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">Contributions to HomeLink</h3>
              <ul className="space-y-2.5">
                {member.contributions.map(c => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-orange/10 text-[#c8461a] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  target={l.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand-navy/30 hover:text-brand-navy transition"
                >
                  <l.icon className="w-4 h-4" /> {l.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {multiple && (
          <div className="mt-6 pt-5 border-t border-[#eef1f5]">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">The team</h3>
            <div className="flex flex-wrap gap-2">
              {list.map(m => {
                const current = m === member;
                return (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => onNavigate(m.slug)}
                    aria-current={current ? 'true' : undefined}
                    aria-label={fullNameOf(m)}
                    className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-sm font-medium transition ${
                      current ? 'bg-brand-navy border-brand-navy text-white' : 'border-gray-200 text-gray-600 hover:border-brand-navy/30 hover:text-brand-navy'
                    }`}
                  >
                    <MemberAvatar member={m} className="w-7 h-7 rounded-full" textClassName="text-[10px]" />
                    {m.firstName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ModalBody>

      {multiple && (
        <div className="dialog-foot shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 border-t border-[#eef1f5] bg-[#f8fafc]">
          <button type="button" onClick={() => onNavigate(prev.slug)} aria-label={`Previous: ${fullNameOf(prev)}`} className={`${modalButton.base} ${modalButton.secondary}`}>
            <ArrowLeft className="w-4 h-4" /> {prev.firstName}
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white font-sans text-[11px] text-gray-500">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white font-sans text-[11px] text-gray-500">→</kbd>
            to browse
          </span>
          <button type="button" onClick={() => onNavigate(next.slug)} aria-label={`Next: ${fullNameOf(next)}`} className={`${modalButton.base} ${modalButton.navy}`}>
            {next.firstName} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </Modal>
  );
}
