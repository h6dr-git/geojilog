import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell min-h-dvh flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md surface-elevated p-6 text-center">
            <AlertTriangle size={40} className="text-gold mx-auto mb-4" />
            <p className="voice-label mb-1">회시생 안내</p>
            <h2 className="text-title font-semibold text-ink">잠깐, 뭔가 꼬였어요</h2>
            <p className="text-caption text-ink-soft mt-2 leading-relaxed">
              새로고침하면 대부분 바로 돌아옵니다. 기록은 서버에 남아 있어요.
            </p>
            {this.state.error?.message && (
              <div className="mt-4 surface-paper p-3 text-left overflow-auto max-h-32">
                <pre className="text-micro text-ink-faint whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-5 w-full btn-primary py-3 gap-2"
            >
              <RotateCcw size={16} />
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
