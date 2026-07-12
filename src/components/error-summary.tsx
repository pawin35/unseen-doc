"use client";

/**
 * Accessible error summary: announced via role="alert", each error links to
 * its field so screen-reader users can jump straight to the problem.
 */
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return (
    <div role="alert" className="error-summary">
      <h2>ไม่สามารถบันทึกได้ กรุณาแก้ไขข้อผิดพลาดต่อไปนี้</h2>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
