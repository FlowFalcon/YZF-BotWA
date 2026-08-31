import { spawn } from 'node:child_process'

/**
 * Generates test media with ffmpeg's synthetic source, so the suite carries no
 * binary fixtures and nothing depends on files left in /tmp by a previous run.
 * The 640x360 frame is deliberately non-square to exercise the padding path.
 */
function generate(args: readonly string[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, 'pipe:1'])
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`fixture generation failed with code ${String(code)}`))
        return
      }
      resolve(new Uint8Array(Buffer.concat(chunks)))
    })
  })
}

export const samplePng = (): Promise<Uint8Array> =>
  generate([
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=640x360:duration=1:rate=1',
    '-frames:v',
    '1',
    '-f',
    'image2',
    '-c:v',
    'png',
  ])

export const sampleMp4 = (): Promise<Uint8Array> =>
  generate([
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=320x240:duration=2:rate=15',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    'frag_keyframe+empty_moov',
    '-f',
    'mp4',
  ])
