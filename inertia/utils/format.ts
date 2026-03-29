import { DateTime } from 'luxon'

/**
 * Format an ISO date string to a human-readable date.
 * Returns null if the value is null/undefined/empty.
 */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const normalized = iso.includes('T') ? iso.split('T')[0] : iso
  const dt = DateTime.fromISO(normalized)
  if (!dt.isValid) return null
  return dt.toLocaleString(DateTime.DATE_FULL)
}

/**
 * Format a numeric amount as currency.
 * @param amount - Numeric value
 * @param currency - ISO 4217 currency code (default: 'USD')
 */
export function formatCurrency(amount: number | null | undefined, currency = 'USD'): string | null {
  if (amount === null || amount === undefined) return null
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

/**
 * Basic email validation.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
