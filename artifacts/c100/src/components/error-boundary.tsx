import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled application error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
          <Card className="w-full max-w-md" data-testid="card-app-error">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
                  <p className="mt-2 text-sm text-gray-600">
                    An unexpected error occurred. You can return to the dashboard and try again.
                  </p>
                </div>
              </div>
              <Button onClick={this.handleReload} data-testid="button-reload-app">
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
