export function isInProduction(): boolean {
  // For webpack/CRA/Next.js
  if (typeof process !== 'undefined' && process.env && 'NODE_ENV' in process.env) {
    return process.env.NODE_ENV === 'production'
  }
  // For Vite
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env.PROD === true
  }
  // Fallback
  return false
}
