"use client";

import { useActionState, useRef, useState } from "react";
import {
  saveAsNewTemplate,
  saveTemplateVersion,
  type TemplateFormState,
} from "@/actions/templates";

export function TemplateEditor({
  templateId,
  docType,
  isBuiltIn,
  initialSource,
}: {
  templateId: string;
  docType: string;
  isBuiltIn: boolean;
  initialSource: string;
}) {
  const [source, setSource] = useState(initialSource);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);

  const [saveState, saveAction, savePending] = useActionState<TemplateFormState, FormData>(
    saveTemplateVersion.bind(null, templateId),
    {},
  );
  const [saveAsState, saveAsAction, saveAsPending] = useActionState<TemplateFormState, FormData>(
    saveAsNewTemplate.bind(null, docType),
    {},
  );

  async function loadPreview() {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = (await res.json()) as { html?: string; error?: string; line?: number };
      if (!res.ok || !data.html) {
        setPreviewHtml(null);
        setPreviewError(
          data.line != null
            ? `ข้อผิดพลาดใกล้บรรทัดที่ ${data.line}: ${data.error}`
            : (data.error ?? "แสดงตัวอย่างไม่สำเร็จ"),
        );
        return;
      }
      setPreviewHtml(data.html);
      requestAnimationFrame(() => previewHeadingRef.current?.focus());
    } catch {
      setPreviewError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setPreviewLoading(false);
    }
  }

  const sourceError = saveState.errors?.source ?? saveAsState.errors?.source;

  return (
    <div>
      <div className="field">
        <label htmlFor="template-source">โค้ดแบบฟอร์ม (HTML + Handlebars)</label>
        <textarea
          id="template-source"
          name="template-source-editor"
          rows={24}
          spellCheck={false}
          wrap="off"
          style={{ fontFamily: "Consolas, monospace", fontSize: "0.9rem" }}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          readOnly={isBuiltIn}
          aria-describedby={`template-source-hint${sourceError ? " template-source-error" : ""}`}
          aria-invalid={sourceError ? true : undefined}
        />
        <p id="template-source-hint" className="hint">
          ตัวแปรที่ใช้ได้ เช่น {"{{doc.number}}"}, {"{{customer.name}}"}, {"{{#each lines}}"},{" "}
          {"{{totals.grandTotal}}"} — ดูรายการเต็มใน README
        </p>
        {sourceError ? (
          <p id="template-source-error" role="alert" className="field-error">
            {sourceError}
          </p>
        ) : null}
      </div>

      <div className="toolbar">
        <button type="button" onClick={loadPreview} disabled={previewLoading}>
          {previewLoading ? "กำลังแสดงตัวอย่าง…" : "แสดงตัวอย่าง"}
        </button>

        {!isBuiltIn ? (
          <form action={saveAction} style={{ display: "inline" }}>
            <input type="hidden" name="source" value={source} />
            <button type="submit" className="primary" disabled={savePending}>
              {savePending ? "กำลังบันทึก…" : "บันทึก (สร้างเวอร์ชันใหม่)"}
            </button>
          </form>
        ) : null}
      </div>
      {saveState.saved ? (
        <p role="status" className="hint">
          บันทึกเวอร์ชันใหม่แล้ว
        </p>
      ) : null}

      <form action={saveAsAction}>
        <input type="hidden" name="source" value={source} />
        <div className="field">
          <label htmlFor="new-template-name">บันทึกเป็นแบบฟอร์มใหม่ชื่อ</label>
          <input
            id="new-template-name"
            name="name"
            type="text"
            size={30}
            aria-invalid={saveAsState.errors?.name ? true : undefined}
            aria-describedby={saveAsState.errors?.name ? "new-template-name-error" : undefined}
          />
          {saveAsState.errors?.name ? (
            <p id="new-template-name-error" role="alert" className="field-error">
              {saveAsState.errors.name}
            </p>
          ) : null}
          <button type="submit" disabled={saveAsPending}>
            {saveAsPending ? "กำลังบันทึก…" : "บันทึกเป็นแบบฟอร์มใหม่"}
          </button>
        </div>
      </form>

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" ref={previewHeadingRef} tabIndex={-1}>
          ตัวอย่างแบบฟอร์ม
        </h2>
        {previewError ? (
          <p role="alert" className="field-error">
            {previewError}
          </p>
        ) : null}
        {previewHtml ? (
          <iframe
            title="ตัวอย่างแบบฟอร์มกับข้อมูลเอกสารตัวอย่าง"
            srcDoc={previewHtml}
            style={{ width: "100%", height: "40rem", border: "1px solid var(--color-border)" }}
          />
        ) : (
          <p className="hint">กดปุ่ม “แสดงตัวอย่าง” เพื่อแสดงแบบฟอร์มกับข้อมูลเอกสารตัวอย่าง</p>
        )}
      </section>
    </div>
  );
}
