import { Component } from 'react';
import { AlertOctagon } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertOctagon className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-navy mb-3">Something went wrong</h1>
          <p className="text-gray-600 mb-8">This page hit an unexpected error. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Reload page</button>
        </div>
      </div>
    );
  }
}
