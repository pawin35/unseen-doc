import { readFileSync } from "node:fs";
import path from "node:path";

// Fonts are injected as data URIs so the same HTML renders identically in the
// preview iframe and in Chromium's print pipeline with no network fetches (ADR 0002).
const FONT_FILES: { family: string; weight: number; file: string }[] = [
  { family: "CS ChatThai", weight: 300, file: "CSChatThai-Light.otf" },
  { family: "CS ChatThai", weight: 400, file: "CSChatThai.otf" },
  { family: "CS ChatThai", weight: 700, file: "CSChatThai-Bold.otf" },
  { family: "CS ChatThai UI", weight: 400, file: "CSChatThaiUI.otf" },
  { family: "CS ChatThai UI", weight: 700, file: "CSChatThaiUI-Bold.otf" },
];

let fontCss: string | null = null;

function getFontCss(): string {
  if (fontCss !== null) return fontCss;
  const fontsDir = path.resolve(process.cwd(), "public", "fonts");
  const rules = FONT_FILES.map(({ family, weight, file }) => {
    const data = readFileSync(path.join(fontsDir, file)).toString("base64");
    return `@font-face {
  font-family: "${family}";
  font-weight: ${weight};
  font-style: normal;
  src: url(data:font/otf;base64,${data}) format("opentype");
}`;
  });
  fontCss = rules.join("\n");
  return fontCss;
}

/** Inject embedded fonts into rendered template HTML (before </head> when present). */
export function injectFonts(html: string): string {
  const styleTag = `<style data-injected="fonts">\n${getFontCss()}\n</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}\n</head>`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1\n${styleTag}`);
  }
  return `${styleTag}\n${html}`;
}
