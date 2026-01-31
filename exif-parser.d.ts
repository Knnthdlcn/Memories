declare module 'exif-parser' {
  export type ExifParser = {
    parse: () => { tags?: Record<string, unknown> }
  }

  export const create: (buffer: Buffer) => ExifParser

  const exif: { create: (buffer: Buffer) => ExifParser }
  export default exif
}
