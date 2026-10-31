import QRCode from 'qrcode'

// 50 x 20 mm label at 200 dpi (200 / 25.4 ≈ 7.874 dots = 1 mm)
export const DPI = 200
export const MM_TO_DOTS = DPI / 25.4
export const W = Math.round(50 * MM_TO_DOTS) // 394 dots
export const H = Math.round(20 * MM_TO_DOTS) // 157 dots

export const MARGIN = 12
export const TOP = 8
export const FOOTER_Y = 136
const QR_MAX_H = 108 // the QR must stay above the footer
const QR_MAX_CELL = 10
const QR_MIN_CELL = 3
const GAP_TO_QR = 10

export interface LabelForm {
  name: string
  model: string
  part: string
  brand: string
  code: string
  footer: string
  copies: number
  chunk: number
  textSize: number
  textWeight: number
  invert: boolean
}

export interface LabelLayout {
  code: string
  // name: string;
  lines: string[]
  footer: string
  /** Width available for the text lines, to the left of the QR code. */
  textMaxW: number
  qr: {
    x: number
    y: number
    cell: number
    size: number
    modules: number
    data: Uint8Array
  }
  warnings: string[]
}

export const clean = (s: unknown): string =>
  String(s ?? '')
    .replace(/[\r\n]/g, ' ')
    .trim()

/** Works out where the QR code sits and what text goes on each line. */
export function layout(f: LabelForm): LabelLayout {
  const code = clean(f.code)

  const lines = [
    ['Name', f.name],
    ['Model', f.model],
    ['Part', f.part],
    ['Brand', f.brand],
    ['Code', f.code],
  ].map(([k, v]) => `${k}: ${clean(v)}`)

  const qr = QRCode.create(code || ' ', { errorCorrectionLevel: 'M' })
  const modules = qr.modules.size

  // The QR code sits at the right edge, above the footer. Text stays on the left.
  const cell = Math.max(QR_MIN_CELL, Math.min(QR_MAX_CELL, Math.floor(QR_MAX_H / modules)))
  const size = modules * cell
  const qrX = W - MARGIN - size
  const qrY = Math.max(4, Math.round((FOOTER_Y - 6 - size) / 2))

  const warnings: string[] = []
  if (cell < 4) {
    warnings.push('The QR code is very small and may not scan. Shorten the code.')
  }
  // name: clean(f.name),

  return {
    code,
    lines,
    footer: clean(f.footer),
    textMaxW: qrX - GAP_TO_QR - MARGIN,
    qr: { x: qrX, y: qrY, cell, size, modules, data: qr.modules.data },
    warnings,
  }
}
