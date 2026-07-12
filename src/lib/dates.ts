/** CE dd/MM/yyyy in Asia/Bangkok (the format printed on documents). */
export function formatDateCE(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Thai long date, e.g. 6 กรกฎาคม 2569 (Buddhist era), for optional template use. */
export function formatDateThaiLong(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
