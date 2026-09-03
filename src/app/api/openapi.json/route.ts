import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "@/lib/openapi";

export async function GET() {
  const doc = generateOpenApiDocument();
  return NextResponse.json(doc, {
    headers: { "Cache-Control": "no-store" },
  });
}
