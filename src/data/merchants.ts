/** A payee that can be found by name, phone number or UPI ID. */
export interface Merchant {
  id: string
  name: string
  /** The VPA money is actually sent to. */
  upiId: string
  /** 10-digit mobile number used to find the merchant. */
  phone: string
  category: string
  city: string
  /** Two letters shown in the avatar. */
  initials: string
  /** Avatar / accent colour. */
  tone: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal'
  /** Present on the merchant registry. */
  verified: boolean
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'sharma-electricals',
    name: 'Sharma Electricals',
    upiId: 'sharma.electricals@okaxis',
    phone: '9876543210',
    category: 'Electronics',
    city: 'Pune',
    initials: 'SE',
    tone: 'blue',
    verified: true,
  },
  {
    id: 'bharat-petro',
    name: 'Bharat Petro Hub',
    upiId: 'bharatpetro.hub@ybl',
    phone: '9700011223',
    category: 'Fuel',
    city: 'Nashik',
    initials: 'BP',
    tone: 'teal',
    verified: true,
  },
  {
    id: 'amazon-pay',
    name: 'Amazon Pay',
    upiId: 'amazonpay@aplaxaxis',
    phone: '9000000421',
    category: 'Marketplace',
    city: 'Online',
    initials: 'AP',
    tone: 'amber',
    verified: true,
  },
  {
    id: 'metro-traders',
    name: 'Metro Traders',
    upiId: 'metro.traders.singh@okhdfcbank',
    phone: '9812345678',
    category: 'Wholesale',
    city: 'Delhi',
    initials: 'MT',
    tone: 'violet',
    verified: false,
  },
  {
    id: 'campus-canteen',
    name: 'Campus Canteen',
    upiId: 'canteen2026@okaxis',
    phone: '9655500111',
    category: 'Food',
    city: 'Bhopal',
    initials: 'CC',
    tone: 'green',
    verified: false,
  },
  {
    id: 'meridian-payroll',
    name: 'Meridian Infotech Payroll',
    upiId: 'peopleops.payroll@hdfcbank',
    phone: '9112233445',
    category: 'Payroll',
    city: 'Bengaluru',
    initials: 'MI',
    tone: 'blue',
    verified: false,
  },
  {
    id: 'rbi-kyc-desk',
    name: 'RBI KYC Update Desk',
    upiId: 'rbi.kyc.updates@ybl',
    phone: '9001234567',
    category: 'KYC update',
    city: 'Unknown',
    initials: 'RK',
    tone: 'red',
    verified: false,
  },
  {
    id: 'sbi-care-desk',
    name: 'SBI Customer Care',
    upiId: 'sbi.care.support@ybl',
    phone: '9004005006',
    category: 'Bank care',
    city: 'Unknown',
    initials: 'SC',
    tone: 'red',
    verified: false,
  },
  {
    id: 'refund-desk',
    name: 'Cashback Refund Desk',
    upiId: 'refund.support@paytm',
    phone: '8999887766',
    category: 'Refunds',
    city: 'Unknown',
    initials: 'CR',
    tone: 'red',
    verified: false,
  },
  {
    id: 'prize-claim',
    name: 'Lucky Winner Claim',
    upiId: 'lucky.winner.claim.rbi.kyc@ybl',
    phone: '8800998877',
    category: 'Prize',
    city: 'Unknown',
    initials: 'LW',
    tone: 'red',
    verified: false,
  },
]

const digits = (value: string) => value.replace(/\D/g, '')

/**
 * Find merchants by name, phone number or UPI ID. A numeric query is matched
 * against the phone number from either end, so "9001" finds 9001234567.
 */
export function searchMerchants(query: string): Merchant[] {
  const q = query.trim().toLowerCase()
  if (!q) return MERCHANTS
  const qDigits = digits(q)

  return MERCHANTS.filter((m) => {
    const name = m.name.toLowerCase()
    const vpa = m.upiId.toLowerCase()
    const phone = m.phone
    if (name.includes(q) || vpa.includes(q) || m.category.toLowerCase().includes(q)) return true
    if (qDigits.length >= 2 && (phone.includes(qDigits) || digits(phone).endsWith(qDigits))) return true
    return false
  })
}

export function getMerchant(id: string | undefined): Merchant | undefined {
  return MERCHANTS.find((m) => m.id === id)
}

/** The most frequent payees, shown on the home screen. */
export function recentMerchants(count = 5): Merchant[] {
  return MERCHANTS.slice(0, count)
}