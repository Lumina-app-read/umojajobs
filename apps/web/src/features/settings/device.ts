/** Libellé lisible d'un User-Agent : navigateur et système, sans bibliothèque supplémentaire. */
export function describeDevice(userAgent: string | null): {
  label: string | null;
  mobile: boolean;
} {
  if (!userAgent) return { label: null, mobile: false };
  const browser =
    [
      ['Edg/', 'Edge'],
      ['OPR/', 'Opera'],
      ['SamsungBrowser/', 'Samsung Internet'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
    ].find(([token]) => userAgent.includes(token as string))?.[1] ?? null;
  const system =
    [
      ['Android', 'Android'],
      ['iPhone', 'iOS'],
      ['iPad', 'iPadOS'],
      ['Windows', 'Windows'],
      ['Mac OS X', 'macOS'],
      ['Linux', 'Linux'],
    ].find(([token]) => userAgent.includes(token as string))?.[1] ?? null;
  const label = [browser, system].filter(Boolean).join(' · ') || null;
  return { label, mobile: /Mobile|Android|iPhone/.test(userAgent) };
}
