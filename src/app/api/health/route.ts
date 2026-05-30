import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    name: "hrlew",
    timestamp: new Date().toISOString(),
  });
}
