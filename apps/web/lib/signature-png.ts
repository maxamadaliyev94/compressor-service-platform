export const MAX_SIGNATURE_BYTES = 2_000_000

export function parsePngDataUrlSignature(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('data:image/png;base64,')) return null
  if (value.length > MAX_SIGNATURE_BYTES) return null
  return value
}
