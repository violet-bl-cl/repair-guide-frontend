// Web Bluetooth only talks to BLE devices. Label printers expose a "serial over BLE"
// service; the UUID differs by vendor, so we list the common ones and then look for
// any writable characteristic.
const u = (short: string) => `0000${short}-0000-1000-8000-00805f9b34fb`

const KNOWN_SERVICES: BluetoothServiceUUID[] = [
  u('18f0'),
  u('ff00'),
  u('ff80'),
  u('ffe0'),
  u('fee7'),
  u('ae00'),
  u('1101'),
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fff0-0000-1000-8000-00805f9b34fb',
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class BlePrinter {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private onDisconnect: (() => void) | null = null

  get connected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic
  }

  /** Opens the browser's device picker, connects, and returns the printer's name. */
  async connect(onDisconnect: () => void): Promise<string> {
    if (!navigator.bluetooth) {
      throw new Error('This browser does not support Web Bluetooth.')
    }

    this.onDisconnect = onDisconnect
    const device = await navigator.bluetooth.requestDevice({
      // Show every nearby BLE device so the printer is never hidden by a wrong name filter.
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES,
    })

    device.addEventListener('gattserverdisconnected', this.handleDisconnect)
    this.device = device

    try {
      const server = await device.gatt!.connect()
      this.characteristic = await this.findWritable(server)
    } catch (e) {
      this.disconnect()
      throw e
    }
    return device.name || 'printer'
  }

  private async findWritable(
    server: BluetoothRemoteGATTServer,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const services = await server.getPrimaryServices()
    let fallback: BluetoothRemoteGATTCharacteristic | null = null

    for (const service of services) {
      const chars = await service.getCharacteristics()
      for (const c of chars) {
        if (c.properties.writeWithoutResponse) return c
        if (c.properties.write && !fallback) fallback = c
      }
    }
    if (fallback) return fallback

    throw new Error(
      'Connected, but no writable Bluetooth characteristic was found. ' +
        'This printer may use classic Bluetooth, which browsers cannot use.',
    )
  }

  /** Sends bytes in small pieces, because BLE writes are limited in size. */
  async send(
    bytes: Uint8Array,
    opts: { chunkSize?: number; delayMs?: number } = {},
  ): Promise<void> {
    const c = this.characteristic
    if (!c || !this.connected) throw new Error('The printer is not connected.')

    const size = opts.chunkSize ?? 100
    const delay = opts.delayMs ?? 20

    for (let i = 0; i < bytes.length; i += size) {
      const piece = bytes.slice(i, i + size)
      if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(piece)
      else await c.writeValueWithResponse(piece)
      await sleep(delay)
    }
  }

  disconnect(): void {
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
      if (this.device.gatt?.connected) this.device.gatt.disconnect()
    }
    this.device = null
    this.characteristic = null
  }

  private handleDisconnect = () => {
    this.characteristic = null
    this.onDisconnect?.()
  }
}
