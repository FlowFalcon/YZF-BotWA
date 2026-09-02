import qrcode from 'qrcode-terminal'

/** Renders a QR payload for the operator. Injectable so tests never write to stdout. */
export type QrRenderer = (qr: string) => void

/** qrcode-terminal writes to stdout itself; `small` keeps the code inside an 80-column terminal. */
export const renderQrToTerminal: QrRenderer = (qr) => {
  qrcode.generate(qr, { small: true })
}
