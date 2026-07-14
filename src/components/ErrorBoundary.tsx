"use client";

import { Component, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    logger.error("ErrorBoundary caught", { message: error.message, stack: error.stack, componentStack: info?.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error en la aplicación</h2>
            <p className="text-sm text-foreground mb-4 font-mono bg-secondary-bg p-4 rounded-xl border border-border text-left overflow-auto">
              {this.state.error.message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="h-10 px-6 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
