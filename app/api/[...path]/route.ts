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
    const headers: Record<string, string> = {
      "Content-Type": res.headers.get("content-type") || "application/json",
    };
    const disposition = res.headers.get("content-disposition");
    if (disposition) {
      headers["Content-Disposition"] = disposition;
    }
    return new NextResponse(data, {
      status: res.status,
      headers,
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
  const body = await request.text();

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
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
