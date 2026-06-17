import Jimp from 'jimp';
import jsQR from 'jsqr';

export interface QrisParsed {
  /** Exact payload decoded from the QR (the value we store). */
  qrisText: string;
  merchant: string | null;
  city: string | null;
  nmid: string | null;
  acquirer: string | null;
  /** Best-effort: whether the QRIS looks like it was issued via GoBiz/GoPay. */
  isGobiz: boolean;
}

/** Run jsQR on a Jimp image (trying both normal & inverted). Returns payload or null. */
function tryDecode(img: Jimp): string | null {
  const { data, width, height } = img.bitmap;
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const code = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' });
  return code?.data ? code.data.trim() : null;
}

/**
 * Decode the QR code embedded in an image buffer → raw QRIS payload string.
 * Pure-JS (jimp + jsQR) so it runs on the constrained staging CT without native build
 * tools. Real-world QRIS photos (a small QR on a big merchant poster, soft contrast,
 * logo in the centre) defeat a single decode pass, so we sweep several longest-edge
 * sizes × light preprocessing variants and return the first hit. jsQR needs the QR
 * modules to be a few px wide: too large OR too small both fail, hence the size sweep.
 */
export async function decodeQrFromImage(buffer: Buffer): Promise<string> {
  const base = await Jimp.read(buffer);
  const maxDim = Math.max(base.bitmap.width, base.bitmap.height);

  // Candidate longest-edge sizes (cap originals at 2200 to bound memory; include the
  // native size and progressively smaller ones so a tiny QR-on-poster still resolves).
  const sizes = Array.from(
    new Set([Math.min(maxDim, 2200), 1800, 1400, 1100, 900, 700, 500].filter((s) => s <= maxDim || s === 500)),
  ).sort((a, b) => b - a);

  // Preprocessing variants, cheapest first. Each gets a fresh clone.
  const variants: Array<(im: Jimp) => Jimp> = [
    (im) => im, // grayscale only
    (im) => im.contrast(0.4), // boost soft contrast
    (im) => im.normalize().contrast(0.6), // stretch range + strong contrast
    (im) => im.normalize().posterize(2), // near-binarize (kill background/logo tints)
  ];

  for (const size of sizes) {
    const scaled = base.clone().grayscale();
    if (size < maxDim) scaled.scale(size / maxDim);
    for (const apply of variants) {
      try {
        const hit = tryDecode(apply(scaled.clone()));
        if (hit) return hit;
      } catch {
        // a variant op failing on a given image must not abort the sweep
      }
    }
  }

  throw new Error('QR tidak terbaca. Pastikan foto fokus, QRIS tidak terpotong, dan cukup terang.');
}

/** Parse EMVCo TLV (tag[2] + len[2] + value[len]) into a tag→value map. */
function parseEmvTlv(payload: string): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.substr(i, 2);
    const len = parseInt(payload.substr(i + 2, 2), 10);
    if (Number.isNaN(len) || i + 4 + len > payload.length) break;
    map.set(tag, payload.substr(i + 4, len));
    i += 4 + len;
  }
  return map;
}

/**
 * Parse a QRIS payload for display fields. The payload itself (qrisText) is always
 * exact from the QR; merchant/nmid/acquirer are best-effort conveniences.
 */
export function parseQris(payload: string): QrisParsed {
  const top = parseEmvTlv(payload);
  const merchant = top.get('59')?.trim() || null;
  const city = top.get('60')?.trim() || null;
  let nmid: string | null = null;
  let acquirer: string | null = null;
  let isGobiz = false;

  // Merchant account info lives in templates 26..51 (each a nested TLV).
  for (let t = 26; t <= 51; t++) {
    const tpl = top.get(String(t).padStart(2, '0'));
    if (!tpl) continue;
    const sub = parseEmvTlv(tpl);
    const gui = (sub.get('00') ?? '').toUpperCase();
    if (/GO-?JEK|GOPAY|GOBIZ/.test(gui)) {
      isGobiz = true;
      acquirer = acquirer ?? 'GoPay/GoBiz';
    }
    // National QRIS template (GUI ID.CO.QRIS.WWW) carries the NMID in subtag 02.
    const s02 = sub.get('02');
    if (s02 && (gui.includes('QRIS') || /^ID/i.test(s02)) && !nmid) nmid = s02.trim();
  }

  // Fallback acquirer hint from the merchant name.
  if (!isGobiz && merchant && /GO-?JEK|GOPAY|GOBIZ/i.test(merchant)) isGobiz = true;

  return { qrisText: payload, merchant, city, nmid, acquirer, isGobiz };
}

/** Decode an image then parse it. Validates it actually looks like a QRIS payload. */
export async function decodeQrisImage(buffer: Buffer): Promise<QrisParsed> {
  const text = await decodeQrFromImage(buffer);
  // QRIS/EMVCo payloads start with tag 00 = "01" (payload format indicator).
  if (!/^00020/.test(text)) {
    throw new Error('QR terbaca tapi bukan kode QRIS pembayaran yang valid.');
  }
  return parseQris(text);
}
