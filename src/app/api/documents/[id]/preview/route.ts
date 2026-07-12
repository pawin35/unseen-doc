import { isAuthed } from "@/lib/session";
import { buildRenderContext, RenderInputError } from "@/lib/render/context";
import { renderTemplate, TemplateCompileError } from "@/lib/render/handlebars";
import { injectFonts } from "@/lib/render/html";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/preview">,
) {
  if (!(await isAuthed())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    const prepared = await buildRenderContext(id);
    const html = injectFonts(
      renderTemplate(prepared.source, prepared.context, prepared.cacheKey),
    );
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof RenderInputError) {
      return new Response(err.message, { status: 404 });
    }
    if (err instanceof TemplateCompileError) {
      return new Response(`แบบฟอร์มมีข้อผิดพลาด: ${err.message}`, { status: 422 });
    }
    throw err;
  }
}
