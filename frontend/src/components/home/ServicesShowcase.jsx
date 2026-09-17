import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '../Reveal';
import ServiceCard from '../ServiceCard';
import ErrorState from '../ErrorState';
import { ServiceCardSkeleton } from '../Skeleton';

const VISIBLE = 4;

// The most-booked services (Home fetches /services?sort=popular&limit=4).
// Cards stagger in on scroll and lift on hover — the lift sits on an inner
// wrapper so it doesn't fight Reveal's own transform transition.
export default function ServicesShowcase({ services, onRetry }) {
  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal className="flex justify-between items-end mb-10 gap-4">
          <div>
            <p className="eyebrow mb-3">Book a Pro</p>
            <h2 className="section-title">Popular services</h2>
          </div>
          <Link to="/services" className="shrink-0 text-brand-navy font-semibold hover:text-brand-orange transition flex items-center gap-1.5 group">
            View All <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.loading ? (
            Array.from({ length: VISIBLE }).map((_, i) => <ServiceCardSkeleton key={i} />)
          ) : services.error ? (
            <ErrorState message="Couldn't load services right now." onRetry={onRetry} />
          ) : services.data.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 py-8">No services listed yet — check back soon.</p>
          ) : (
            services.data.slice(0, VISIBLE).map((s, i) => (
              <Reveal key={s.id} delay={i * 70} className="h-full">
                <div className="h-full transition-transform duration-300 hover:-translate-y-1.5">
                  <ServiceCard service={s} />
                </div>
              </Reveal>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
