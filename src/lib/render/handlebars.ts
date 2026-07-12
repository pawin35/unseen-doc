import Handlebars from "handlebars";
import { formatDateCE, formatDateThaiLong } from "@/lib/dates";
import { bahtTextFromSatang } from "@/lib/calc/bahtText";
import { formatQty, formatSatang } from "@/lib/money";

// Isolated instance so template helpers never leak into other Handlebars users.
const hbs = Handlebars.create();

// Helper names must not collide with context field names (e.g. lines[].qty):
// Handlebars resolves helpers before fields, so a helper named "qty" would
// shadow {{qty}} inside {{#each lines}}.
hbs.registerHelper("fmtMoney", (satang: unknown) =>
  typeof satang === "number" ? formatSatang(satang) : "",
);
hbs.registerHelper("fmtQty", (thousandths: unknown) =>
  typeof thousandths === "number" ? formatQty(thousandths) : "",
);
hbs.registerHelper("thaiDate", (date: unknown) =>
  date instanceof Date ? formatDateCE(date) : "",
);
hbs.registerHelper("thaiDateLong", (date: unknown) =>
  date instanceof Date ? formatDateThaiLong(date) : "",
);
hbs.registerHelper("bahttext", (satang: unknown) =>
  typeof satang === "number" ? bahtTextFromSatang(satang) : "",
);
hbs.registerHelper("inc", (value: unknown) =>
  typeof value === "number" ? value + 1 : value,
);
hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export class TemplateCompileError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const compileCache = new Map<string, Handlebars.TemplateDelegate>();

/**
 * Compile template source (cached by `cacheKey`, e.g. the TemplateVersion id)
 * and execute it against the render context.
 */
export function renderTemplate(
  source: string,
  context: unknown,
  cacheKey?: string,
): string {
  try {
    let compiled = cacheKey ? compileCache.get(cacheKey) : undefined;
    if (!compiled) {
      compiled = hbs.compile(source, { strict: false });
      // Compile is lazy in Handlebars: force parse errors now.
      compiled({});
      if (cacheKey) compileCache.set(cacheKey, compiled);
    }
    return compiled(context, {
      allowProtoPropertiesByDefault: false,
      allowProtoMethodsByDefault: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lineMatch = /line (\d+)/i.exec(message);
    throw new TemplateCompileError(
      message,
      lineMatch ? parseInt(lineMatch[1], 10) : undefined,
    );
  }
}
