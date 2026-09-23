import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const search = request.nextUrl.search;
  const targetUrl = `${backendUrl}/${path.join("/")}${search}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        Accept: request.headers.get("accept") || "application/json",
      },
      cache: "no-store",
    });
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Backend proxy error", details: err.message },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const search = request.nextUrl.search;
  const targetUrl = `${backendUrl}/${path.join("/")}${search}`;
  const contentType = request.headers.get("content-type") || "";
  let body: any;
  if (contentType.includes("application/json") || contentType.includes("text/")) {
    body = await request.text();
  } else {
    body = await request.arrayBuffer();
  }

  try {
    const forwardHeaders: Record<string, string> = {};
    if (contentType) {
      forwardHeaders["Content-Type"] = contentType;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: forwardHeaders,
      body,
      cache: "no-store",
    });
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Backend proxy error", details: err.message },
      { status: 502 }
    );
  }
}
