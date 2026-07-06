"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FCFAF7] p-8">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error en la aplicación</h2>
            <p className="text-sm text-[#5C3E35] mb-4 font-mono bg-[#FAF6F0] p-4 rounded-xl border border-[#E8E0D8] text-left overflow-auto">
              {this.state.error.message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="h-10 px-6 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66]"
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
