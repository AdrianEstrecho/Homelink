import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShoppingCart, Search, CreditCard, Truck, Wrench, CalendarCheck, UserCheck, Activity } from 'lucide-react';
import Reveal from '../Reveal';

// Mirrors the real customer flows: ORDER_STEPS / BOOKING_STEPS in
// backend/utils/tracking.js and the methods in PaymentMethodPicker.jsx.
const TRACKS = [
  {
    key: 'products',
    label: 'Buying products',
    icon: ShoppingCart,
    cta: { to: '/products', text: 'Browse Products' },
    steps: [
      { icon: Search, title: 'Find what you need', desc: 'Browse by category, compare specs, and read reviews from verified buyers.' },
      { icon: CreditCard, title: 'Check out securely', desc: 'Pay by card, GCash, QR Ph, or bank transfer, and apply voucher codes at checkout.' },
      { icon: Truck, title: 'Track your delivery', desc: 'Follow your order from processing to shipped to delivered, with an estimated arrival date.' },
      { icon: Wrench, title: 'Add installation', desc: 'Book a verified technician to install what you bought, all from the same account.' },
    ],
  },
  {
    key: 'services',
    label: 'Booking a service',
    icon: CalendarCheck,
    cta: { to: '/services', text: 'Book a Service' },
    steps: [
      { icon: Search, title: 'Choose a service', desc: 'Installation, cleaning, repair, or maintenance, with starting prices shown upfront.' },
      { icon: CalendarCheck, title: 'Pick your schedule', desc: 'Choose a date and time that suits you. First-time bookings get 15% off automatically.' },
      { icon: UserCheck, title: 'Get a verified pro', desc: 'We confirm your booking and assign a background-checked technician matched to the job.' },
      { icon: Activity, title: 'Track to completion', desc: 'Follow the job from confirmed to in progress to completed, right from your account.' },
    ],
  },
];

const STEP_MS = 2800;

// Two tracks (products / services), each a 4-step flow. While the steps are
// on screen the highlight walks through them on a timer, filling the connector
// line as it goes; pointer hover or keyboard focus inside pauses it, and
// hovering, focusing, or tapping a step jumps straight there. Reduced-motion
// users get the same highlight without the autoplay.
export default function HowItWorks() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const stepsRef = useRef(null);
  const track = TRACKS[trackIndex];

  useEffect(() => {
    const el = stepsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActiveStep(s => (s + 1) % track.steps.length), STEP_MS);
    return () => clearInterval(id);
  }, [inView, paused, track]);

  const selectTrack = (i) => {
    setTrackIndex(i);
    setActiveStep(0);
  };

  return (
    <section className="py-20 md:py-24 bg-brand-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-xl mx-auto mb-8">
          <p className="eyebrow justify-center mb-3">How It Works</p>
          <h2 className="section-title">From checkout to a job well done</h2>
          <p className="text-gray-500 mt-3 leading-relaxed">Whether you’re buying a product or booking a pro, every step happens in one place.</p>
        </Reveal>

        <Reveal className="flex justify-center mb-12">
          <div className="inline-flex p-1 rounded-full bg-white border border-gray-200 shadow-sm" role="tablist" aria-label="How it works">
            {TRACKS.map((t, i) => {
              const isActive = trackIndex === i;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectTrack(i)}
                  className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                    isActive ? 'bg-brand-navy text-white shadow-md shadow-brand-navy/20' : 'text-gray-500 hover:text-brand-navy'
                  }`}
                >
                  <t.icon className="hidden sm:block w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal>
          <div
            ref={stepsRef}
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 rounded-full bg-brand-navy/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-orange to-amber-400 transition-[width] duration-700 ease-out"
                style={{ width: `${(activeStep / (track.steps.length - 1)) * 100}%` }}
              />
            </div>
            <ol key={track.key} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-8">
              {track.steps.map((step, i) => {
                const isActive = i === activeStep;
                const isDone = i < activeStep;
                return (
                  <li key={step.title} className="fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <button
                      type="button"
                      onClick={() => setActiveStep(i)}
                      onMouseEnter={() => setActiveStep(i)}
                      onFocus={() => setActiveStep(i)}
                      aria-current={isActive ? 'step' : undefined}
                      className="group w-full text-center rounded-2xl px-2 pb-2"
                    >
                      <div
                        className={`relative mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                          isActive
                            ? 'bg-gradient-to-br from-brand-orange to-amber-500 scale-110 shadow-xl shadow-brand-orange/30'
                            : 'bg-gradient-to-br from-brand-navy to-brand-blue shadow-lg shadow-brand-navy/20 group-hover:scale-105'
                        }`}
                      >
                        {isActive && <span className="step-pulse absolute inset-0 rounded-2xl bg-brand-orange" aria-hidden="true" />}
                        <step.icon className="relative w-6 h-6 text-white" />
                        <span
                          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ring-4 ring-brand-light tabular-nums transition-colors duration-500 ${
                            isDone ? 'bg-brand-teal text-white' : isActive ? 'bg-brand-navy text-white' : 'bg-brand-orange text-white'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                      </div>
                      <h3 className={`font-display font-bold mb-2 transition-colors duration-300 ${isActive ? 'text-brand-orange' : 'text-brand-ink'}`}>
                        {step.title}
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed max-w-[16rem] mx-auto">{step.desc}</p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>

        <div className="text-center mt-12">
          <Link to={track.cta.to} className="text-brand-navy font-semibold hover:text-brand-orange transition inline-flex items-center gap-1.5 group">
            {track.cta.text} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
