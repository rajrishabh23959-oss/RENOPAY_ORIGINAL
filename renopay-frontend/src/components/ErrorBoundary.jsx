import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-textLight flex flex-col items-center justify-center p-6 text-center animate-fadeUp">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/30 flex items-center justify-center text-3xl mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-extrabold text-textLight mb-2">Something went wrong</h2>
          <p className="text-muted text-xs max-w-xs mb-6">
            We encountered an unexpected display issue. Your balance and transactions remain completely safe.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-card border border-line text-xs font-bold text-textLight hover:border-accent/40 active:scale-95 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:brightness-110 active:scale-95 shadow-accentGlow transition-all"
            >
              Reload RenoPay
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
