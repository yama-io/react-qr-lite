/**
 * Unicode -> Shift-JIS reverse lookup table (for kanji mode).
 *
 * Instead of embedding a JIS X 0208 conversion table in the bundle (tens of
 * kilobytes if done naively), we batch-decode every double-byte code with
 * the native TextDecoder("shift_jis") and build the inverse mapping at
 * runtime. The bundle cost is near zero, and the table is built lazily,
 * once, the first time kanji mode is actually used.
 *
 * Only the double-byte ranges permitted by QR kanji mode are covered:
 *   0x8140-0x9FFC / 0xE040-0xEBBF (trail bytes 0x40-0xFC, excluding 0x7F)
 *
 * In environments whose TextDecoder lacks shift_jis (some edge runtimes),
 * the table becomes null and callers fall back to byte mode.
 *
 * Note: the Encoding Standard's shift_jis decoder is effectively CP932,
 * which contains duplicate codes in the NEC special character rows
 * (U+2252 and friends). Scanning codes in ascending order with first-wins
 * keeps the standard JIS code for such characters.
 */

/** undefined = not built yet, null = unavailable in this environment */
let table: Map<string, number> | null | undefined;

function buildTable(): Map<string, number> | null {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder("shift_jis", { fatal: false });
  } catch {
    return null;
  }

  // Concatenate all candidate double-byte codes separated by newlines and
  // decode them in a single call. Invalid pairs decode to fragments
  // containing U+FFFD, but even when a trail byte is pushed back, the 0x0A
  // separator still decodes as ASCII, so fragments never fall out of step.
  const codes: number[] = [];
  const bytes: number[] = [];
  for (const [lo, hi, max] of [
    [0x81, 0x9f, 0x9ffc],
    [0xe0, 0xeb, 0xebbf],
  ] as const) {
    for (let lead = lo; lead <= hi; lead++) {
      for (let trail = 0x40; trail <= 0xfc; trail++) {
        if (trail === 0x7f) continue;
        const code = (lead << 8) | trail;
        if (code > max) break;
        codes.push(code);
        bytes.push(lead, trail, 0x0a);
      }
    }
  }

  const pieces = decoder.decode(new Uint8Array(bytes)).split("\n");
  if (pieces.length !== codes.length + 1) return null; // unexpected desynchronization

  const map = new Map<string, number>();
  for (let i = 0; i < codes.length; i++) {
    const s = pieces[i]!;
    // A valid code always decodes to exactly one BMP character; U+FFFD or multiple chars mean invalid
    if (s.length === 1 && s !== "\ufffd" && !map.has(s)) {
      map.set(s, codes[i]!);
    }
  }
  return map;
}

/** Whether kanji mode is available in this environment (builds the table on first call). */
export function kanjiModeAvailable(): boolean {
  if (table === undefined) table = buildTable();
  return table !== null;
}

/**
 * Returns a character's double-byte Shift-JIS code (QR kanji mode ranges
 * only). Undefined for characters outside the ranges or in environments
 * without shift_jis support.
 */
export function sjisCode(ch: string): number | undefined {
  if (table === undefined) table = buildTable();
  return table === null ? undefined : table.get(ch);
}

/** Whether the whole string is encodable in kanji mode (false for empty strings). */
export function isKanjiEncodable(text: string): boolean {
  if (text.length === 0) return false;
  if (table === undefined) table = buildTable();
  if (table === null) return false;
  for (let i = 0; i < text.length; i++) {
    if (!table.has(text[i]!)) return false;
  }
  return true;
}
