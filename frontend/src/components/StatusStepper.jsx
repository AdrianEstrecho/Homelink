// Generalized from the installer-only stepper in pages/employee/Dashboard.jsx (JobCard's
// StatusStepper) so both the order and booking tracking views can share one implementation.
export default function StatusStepper({ steps, labels, currentStatus }) {
  const currentIndex = steps.indexOf(currentStatus);
  if (currentIndex === -1) return null;
  const isDone = currentStatus === steps[steps.length - 1];

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1.5">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            i < currentIndex || (i === currentIndex && isDone) ? 'bg-green-100 text-green-700'
              : i === currentIndex ? 'bg-brand-orange/15 text-brand-orange'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {labels[step] || step}
          </span>
          {i < steps.length - 1 && (
            <span className={`w-3 h-px ${i < currentIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
