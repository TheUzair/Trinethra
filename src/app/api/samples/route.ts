import { NextResponse } from "next/server";
import samples from "@/data/sample-transcripts.json";

export function GET() {
  return NextResponse.json(samples);
}
