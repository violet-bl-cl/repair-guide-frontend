import { FOOTER_Y, H, MARGIN, TOP, W, layout, type LabelForm } from './labelSetup'

const FONT = '"IBM Plex Sans", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif'

export const MIN_TEXT = 10
export const MAX_TEXT = 22

export interface Rendered {
  /** One entry per dot, row by row: 1 = black. */
  dark: Uint8Array
  warnings: string[]
}

/**
 * Draws the whole label (text and QR code) on a canvas, then turns it into pure
 * black and white. The preview shows this canvas and the printer gets the same dots,
 * so the two always match.
 */
export function renderLabel(canvas: HTMLCanvasElement, f: LabelForm): Rendered {
  const v = layout(f)
  const warnings = [...v.warnings]

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  // const defaultWeight = f.textWeight !== null ? f.textWeight : 400;
  const weight = Number(f.textWeight) || 400
  // Everything is bold. A thin outline makes the strokes heavier, which helps on thermal paper.
  const font = (px: number) => `${weight} ${px}px ${FONT}`
  ctx.strokeStyle = '#000'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 0.8
  const draw = (t: string, x: number, y: number, outline = 0) => {
    ctx.fillText(t, x, y)
    if (outline > 0) {
      ctx.lineWidth = outline
      ctx.strokeText(t, x, y)
    }
  }

  const wide = (t: string, px: number) => {
    ctx.font = font(px)
    return ctx.measureText(t).width
  }

  // Vertical plan for a given text size: name on top, then four lines, all above the footer.
  const plan = (px: number) => {
    const nameSize = px + 4
    // const startY = v.name ? TOP + nameSize + 6 : TOP + 6
    const startY = TOP + 6
    const pitch = px + 4
    return { nameSize, startY, pitch, bottom: startY + 3 * pitch + px }
  }

  const wanted = Math.min(MAX_TEXT, Math.max(MIN_TEXT, Math.round(Number(f.textSize) || 18)))
  let size = wanted
  while (
    size > MIN_TEXT &&
    (plan(size).bottom > FOOTER_Y - 2 || !v.lines.every((t) => wide(t, size) <= v.textMaxW))
  ) {
    size--
  }
  if (size < wanted && size < 14) {
    warnings.push(`The text shrank to ${size} dots to fit. Shorten the longest line.`)
  }

  const p = plan(size)
  ctx.fillStyle = '#000'

  // if (v.name) {
  //   let nSize = p.nameSize
  //   while (nSize > MIN_TEXT && wide(v.name, nSize) > v.textMaxW) nSize--
  //   ctx.font = font(nSize)
  //   draw(v.name, MARGIN, TOP)
  //   if (nSize < p.nameSize - 6) warnings.push('The name is long, so it was shrunk to fit.')
  // }

  ctx.font = font(size)
  v.lines.forEach((t, i) => draw(t, MARGIN, p.startY + i * p.pitch))

  // Footer: centred, shrunk to fit the label width.
  let fSize = Math.max(10, Math.round(size * 0.7))
  while (fSize > 8 && wide(v.footer, fSize) > W - 2 * MARGIN) fSize--
  ctx.font = font(fSize)
  draw(v.footer, Math.round((W - ctx.measureText(v.footer).width) / 2), FOOTER_Y, 0.2)

  // QR code: each module is a cell x cell block of dots.
  const { x, y, cell, modules, data } = v.qr
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (data[row * modules + col]) ctx.fillRect(x + col * cell, y + row * cell, cell, cell)
    }
  }

  // Threshold to 1 bit. Writing it back means the preview shows exactly what prints.
  const img = ctx.getImageData(0, 0, W, H)
  const px = img.data
  const dark = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const lum = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11
    const isDark = lum < 150
    dark[i] = isDark ? 1 : 0
    const c = isDark ? 0 : 255
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = c
    px[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  return { dark, warnings }
}

const enc = new TextEncoder()

/**
 * Packs the dots for the TSPL BITMAP command. A 0 bit prints a black dot and a 1 bit
 * leaves the paper white. `invert` flips that for printers that behave the other way.
 */
export function packBitmap(dark: Uint8Array, invert: boolean) {
  const widthBytes = Math.ceil(W / 8)
  const out = new Uint8Array(widthBytes * H)
  const white = invert ? 0 : 1

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < widthBytes * 8; x++) {
      const bit = x < W ? ((dark[y * W + x] === 1) !== invert ? 0 : 1) : white
      if (bit) out[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return { widthBytes, data: out }
}

/** Builds the bytes to send to the printer: setup commands, the label image, and PRINT. */
export function buildLabelBytes(f: LabelForm, canvas?: HTMLCanvasElement): Uint8Array {
  const { dark } = renderLabel(canvas ?? document.createElement('canvas'), f)
  const bmp = packBitmap(dark, f.invert)
  const copies = Math.min(99, Math.max(1, Math.floor(Number(f.copies) || 1)))

  const head = enc.encode(
    ['SIZE 50 mm,20 mm', 'GAP 2 mm,0 mm', 'DIRECTION 1', 'CLS'].join('\r\n') +
      `\r\nBITMAP 0,0,${bmp.widthBytes},${H},0,`,
  )
  const tail = enc.encode(`\r\nPRINT ${copies}\r\n`)

  const out = new Uint8Array(head.length + bmp.data.length + tail.length)
  out.set(head, 0)
  out.set(bmp.data, head.length)
  out.set(tail, head.length + bmp.data.length)
  return out
}
