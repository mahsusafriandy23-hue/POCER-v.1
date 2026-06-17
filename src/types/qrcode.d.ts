// Minimal ambient types for the `qrcode` package (no @types published for our use).
declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    scale?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export function toBuffer(text: string, options?: QRCodeToDataURLOptions & { type?: string }): Promise<Buffer>;
}
