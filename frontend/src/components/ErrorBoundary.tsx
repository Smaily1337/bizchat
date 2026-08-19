import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="rounded-2xl border border-glass-border bg-glass-fill p-8 shadow-xl max-w-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold font-display text-[var(--text-bright)]">
              Coś poszło nie tak
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Wystąpił nieoczekiwany błąd podczas wyświetlania tego widoku.
            </p>
            {this.state.error && (
              <pre className="mt-3 overflow-x-auto rounded-soft border border-glass-border bg-black/40 p-3 text-left font-mono text-xs text-red-400">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="mt-5 rounded-control bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow hover:opacity-90 transition"
            >
              Wróć do strony głównej
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
