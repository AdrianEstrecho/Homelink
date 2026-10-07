import { Fragment } from 'react';
import { useReveal } from '../hooks/useReveal';

// Heading text whose words rise one after another out of a mask as it scrolls into view
// (.split-word in motion.css). Screen readers get the plain sentence; the animated words are
// hidden from them. Drop it inside the heading element in place of the text.
export default function SplitText({ text }) {
  const [ref, inView] = useReveal();

  return (
    <span ref={ref} className={inView ? 'split-in' : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((word, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className="split-word">
              <span style={{ '--i': i }}>{word}</span>
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}
