import { readFile } from "node:fs/promises";
import path from "node:path";
import { isAuthed } from "@/lib/session";
import { resolveUploadPath, UploadError } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/uploads/[...path]">,
) {
  if (!(await isAuthed())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { path: segments } = await ctx.params;
  try {
    const filePath = resolveUploadPath(segments.join("/"));
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
    if (!contentType) {
      return new Response("Not found", { status: 404 });
    }
    const data = await readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    if (err instanceof UploadError) {
      return new Response("Bad request", { status: 400 });
    }
    return new Response("Not found", { status: 404 });
  }
}
