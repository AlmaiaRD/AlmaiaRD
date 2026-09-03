"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .swagger-ui .topbar { display: none; }
        .swagger-ui { font-family: inherit; }
      `}</style>
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold">API Almaia RD</h1>
        <p className="text-sm text-gray-500">
          Documentación de la API (generada desde los esquemas Zod)
        </p>
        <a
          href="/api/openapi.json"
          className="inline-block mt-2 text-sm text-blue-600 underline"
          target="_blank"
          rel="noreferrer"
        >
          Ver JSON /api/openapi.json
        </a>
      </header>
      <SwaggerUI url="/api/openapi.json" />
    </div>
  );
}
