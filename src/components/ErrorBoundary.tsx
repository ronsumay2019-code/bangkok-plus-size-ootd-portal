import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Section Encountered an Issue';
      return (
        <div className="p-6 my-4 bg-gradient-to-br from-neutral-900 via-rose-950/20 to-neutral-900 border-2 border-rose-600/40 rounded-2xl shadow-2xl text-left max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-bold uppercase">
                  Protected
                </span>
              </h3>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                The portal caught an unexpected render error and prevented the entire screen from crashing. Your orders, live intake, and store state are completely safe.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Section</span>
                </button>

                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-neutral-700"
                >
                  <span>{this.state.showDetails ? 'Hide Diagnostics' : 'View Diagnostics'}</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {this.state.showDetails && (
                <div className="mt-4 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-400 font-mono text-[11px] overflow-x-auto max-h-60 space-y-2">
                  <div className="text-rose-400 font-bold">
                    {this.state.error?.name}: {this.state.error?.message}
                  </div>
                  {this.state.error?.stack && (
                    <pre className="text-[10px] text-neutral-500 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-[10px] text-neutral-600 whitespace-pre-wrap border-t border-neutral-900 pt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
