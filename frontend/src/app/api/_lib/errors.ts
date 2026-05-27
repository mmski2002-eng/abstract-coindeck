import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function serverErrorResponse(route: string, error: unknown, message = "Internal server error") {
  const errorId = randomUUID();
  console.error(`[api:${route}] error_id=${errorId} message=${normalizeErrorMessage(error)}`);
  return NextResponse.json(
    { error: message, errorId },
    { status: 500 },
  );
}
