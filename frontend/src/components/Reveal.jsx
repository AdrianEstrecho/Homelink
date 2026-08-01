import { useReveal } from '../hooks/useReveal';

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const [ref, inView] = useReveal();

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'reveal-in' : ''} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
