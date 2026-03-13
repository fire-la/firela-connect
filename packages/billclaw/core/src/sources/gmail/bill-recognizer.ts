/**
 * Bill Recognition Service - Framework-agnostic bill detection from email content
 *
 * Analyzes email content to determine if it's a bill and extracts relevant information.
 * Uses keyword matching, sender detection, and confidence scoring.
 */

export interface EmailContent {
  id: string
  subject: string
  from: string
  to?: string
  date: string
  body: string
  attachments?: Array<{
    filename: string
    contentType: string
    data?: string
  }>
}

export interface GmailConfig {
  clientId?: string
  clientSecret?: string
  historyId?: string
  pubsubTopic?: string
  senderWhitelist: string[]
  keywords: string[]
  confidenceThreshold: number
  requireAmount: boolean
  requireDate: boolean
  billTypePatterns?: Record<string, string[]>
}

export interface BillRecognition {
  isBill: boolean
  confidence: number
  amount?: number
  currency?: string
  dueDate?: string
  billType?: string
  merchant?: string
  accountNumber?: string
  reasons: string[]
}

/**
 * Default bill detection keywords
 * Includes both phrases and individual words for better matching
 */
export const DEFAULT_KEYWORDS = [
  // Phrases
  "invoice",
  "statement",
  "bill due",
  "receipt",
  "payment due",
  "amount due",
  "past due",
  "payment received",
  "your bill",
  "account statement",
  "credit card statement",
  "utility bill",
  "electric bill",
  "water bill",
  "internet bill",
  "phone bill",
  "insurance premium",
  "subscription",
  "membership",
  // Individual words for better matching
  "premium",
  "due",
  "notice",
  "invoice",
  "statement",
  "bill",
  "receipt",
  "payment",
  "subscription",
  "membership",
]

/**
 * Known billing domains (extracted from common service providers)
 */
export const KNOWN_BILLING_DOMAINS = [
  "@netflix.com",
  "@paypal.com",
  "@amazon.com",
  "@apple.com",
  "@google.com",
  "@spotify.com",
  "@att.com",
  "@verizon.com",
  "@comcast.com",
  "@pge.com",
  "@chase.com",
  "@citibank.com",
  "@amex.com",
  "@discover.com",
  "@capitalone.com",
  "@geico.com",
  "@progressive.com",
  "@statefarm.com",
]

/**
 * Default bill type patterns for classification
 * Ordered by specificity (more specific patterns first)
 */
const DEFAULT_BILL_TYPE_PATTERNS: Record<string, string[]> = {
  Utility: ["electric", "gas", "water", "utility", "power", "energy", "pge"],
  Internet: ["internet", "broadband", "wifi", "fiber", "xfinity", "comcast"],
  Phone: [
    "phone",
    "wireless",
    "mobile",
    "cellular",
    "att",
    "verizon",
    "t-mobile",
  ],
  Insurance: [
    "insurance",
    "premium",
    "coverage",
    "geico",
    "progressive",
    "state farm",
  ],
  Subscription: [
    "subscription",
    "membership",
    "netflix",
    "spotify",
    "amazon prime",
  ],
  "Credit Card": ["credit card", "visa", "mastercard", "amex", "discover"],
  Housing: ["rent", "lease", "mortgage", "housing", "apartment"],
  Loan: ["loan", "financing", "student loan"],
  Invoice: ["invoice", "billing", "amount due", "payment due"],
  Receipt: ["receipt", "purchase", "order confirmation"],
  Generic: ["statement"], // Most generic, should be last
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  const match = email.toLowerCase().match(/@([^@\s]+)$/)
  return match ? match[1] : ""
}

/**
 * Check if sender is in whitelist
 */
function isWhitelistedSender(from: string, whitelist: string[]): boolean {
  const fromLower = from.toLowerCase()

  for (const entry of whitelist) {
    const entryLower = entry.toLowerCase()

    // Exact match (e.g., "billing@paypal.com")
    if (fromLower === entryLower) {
      return true
    }

    // Domain match (e.g., "@paypal.com" matches "billing@paypal.com")
    if (entryLower.startsWith("@") && fromLower.endsWith(entryLower)) {
      return true
    }

    // Wildcard pattern (e.g., "*@paypal.com")
    if (
      entryLower.startsWith("*@") &&
      fromLower.endsWith(entryLower.slice(1))
    ) {
      return true
    }
  }

  return false
}

/**
 * Check if text contains any keywords (case-insensitive)
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const textLower = text.toLowerCase()
  return keywords.some((keyword) => textLower.includes(keyword.toLowerCase()))
}

/**
 * Extract amount from text using regex patterns
 */
function extractAmount(
  text: string,
): { amount: number; currency: string } | null {
  // Pattern 1: $123.45 or $1,234.56
  const usdPattern = /\$\s*([0-9,]+\.?\d*)/g
  const usdMatch = usdPattern.exec(text)
  if (usdMatch) {
    const amount = parseFloat(usdMatch[1].replace(/,/g, ""))
    if (!isNaN(amount) && amount > 0) {
      return { amount, currency: "USD" }
    }
  }

  // Pattern 2: €123,45 or €123.45
  const eurPattern = /€\s*([0-9.,]+(?:[,.]\d{2})?)/g
  const eurMatch = eurPattern.exec(text)
  if (eurMatch) {
    const amountStr = eurMatch[1].replace(/\./g, "").replace(/,/, ".")
    const amount = parseFloat(amountStr)
    if (!isNaN(amount) && amount > 0) {
      return { amount, currency: "EUR" }
    }
  }

  // Pattern 3: £123.45
  const gbpPattern = /£\s*([0-9,]+\.?\d*)/g
  const gbpMatch = gbpPattern.exec(text)
  if (gbpMatch) {
    const amount = parseFloat(gbpMatch[1].replace(/,/g, ""))
    if (!isNaN(amount) && amount > 0) {
      return { amount, currency: "GBP" }
    }
  }

  // Pattern 4: Amount: 123.45 USD
  const amountPattern = /amount[:\s]+([0-9,]+\.?\d*)\s*(USD|EUR|GBP|CAD|AUD)?/i
  const amountMatch = amountPattern.exec(text)
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ""))
    const currency = amountMatch[2]?.toUpperCase() || "USD"
    if (!isNaN(amount) && amount > 0) {
      return { amount, currency }
    }
  }

  return null
}

/**
 * Extract date from text using regex patterns
 */
function extractDate(text: string): string | null {
  // Pattern 1: MM/DD/YYYY or DD/MM/YYYY
  const datePattern1 = /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(20\d{2})\b/g
  const match1 = datePattern1.exec(text)
  if (match1) {
    return match1[0]
  }

  // Pattern 2: YYYY-MM-DD
  const datePattern2 = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g
  const match2 = datePattern2.exec(text)
  if (match2) {
    return match2[0]
  }

  // Pattern 3: "Due Date: January 15, 2024" or "Due: Jan 15"
  const dueDatePattern =
    /(?:due|payment|expire)[s:\s]+([A-Za-z]+)\s+(\d{1,2}),?\s*(20\d{2})?/i
  const match3 = dueDatePattern.exec(text)
  if (match3) {
    const month = match3[1]
    const day = match3[2]
    const year = match3[3] || new Date().getFullYear()
    return `${month} ${day}, ${year}`
  }

  return null
}

/**
 * Classify bill type based on content
 * Returns the type with the most matching keywords
 */
function classifyBillType(
  subject: string,
  body: string,
  patterns: Record<string, string[]>,
): string | undefined {
  const content = `${subject} ${body}`.toLowerCase()

  // Score each bill type by number of matching keywords
  const scores: Array<{ type: string; score: number }> = []

  for (const [billType, keywords] of Object.entries(patterns)) {
    const matchCount = keywords.filter((keyword) =>
      content.includes(keyword.toLowerCase()),
    ).length
    if (matchCount > 0) {
      scores.push({ type: billType, score: matchCount })
    }
  }

  // Return type with highest score, or undefined if no matches
  if (scores.length === 0) {
    return undefined
  }

  // Sort by score descending, then by specificity (longer keyword matches first)
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Tie-breaker: prefer types that come first (more specific patterns defined first)
    return 0
  })

  return scores[0].type
}

/**
 * Recognize if an email is a bill and extract relevant information
 */
export function recognizeBill(
  email: EmailContent,
  config: GmailConfig,
): BillRecognition {
  const reasons: string[] = []
  let confidence = 0

  // Use custom keywords or defaults
  const keywords =
    config.keywords.length > 0 ? config.keywords : DEFAULT_KEYWORDS

  // Use custom bill type patterns or defaults
  const billTypePatterns = config.billTypePatterns || DEFAULT_BILL_TYPE_PATTERNS

  // Check 1: Sender whitelist (strongest signal)
  const isWhitelisted = isWhitelistedSender(email.from, config.senderWhitelist)
  if (isWhitelisted) {
    confidence += 0.4
    reasons.push("Sender is in whitelist")
  }

  // Check 2: Known billing domain
  const isKnownBillingDomain = KNOWN_BILLING_DOMAINS.some((d) => {
    const billingDomain = d.startsWith("@") ? d : `@${d}`
    return email.from.toLowerCase().endsWith(billingDomain)
  })
  if (isKnownBillingDomain) {
    confidence += 0.25
    reasons.push("Known billing domain")
  }

  // Check 2.5: Sender contains "billing" - strong signal
  if (email.from.toLowerCase().includes("billing")) {
    confidence += 0.3
    reasons.push("Sender is billing address")
  }

  // Check 3: Keyword matching in subject and body
  const subjectHasKeywords = containsKeywords(email.subject, keywords)
  const bodyHasKeywords = containsKeywords(email.body, keywords)

  if (subjectHasKeywords) {
    confidence += 0.2
    reasons.push("Subject contains bill keywords")
  }

  if (bodyHasKeywords) {
    confidence += 0.1
    reasons.push("Body contains bill keywords")
  }

  // Extract amount and date
  const amountInfo = extractAmount(email.subject + " " + email.body)
  const dueDate = extractDate(email.subject + " " + email.body)

  // Bonus: Has amount
  if (amountInfo) {
    confidence += 0.05
    reasons.push("Contains amount")
  }

  // Check required fields
  if (config.requireAmount && !amountInfo) {
    return {
      isBill: false,
      confidence: 0,
      reasons: ["Missing required amount"],
    }
  }

  if (config.requireDate && !dueDate) {
    return {
      isBill: false,
      confidence: 0,
      reasons: ["Missing required date"],
    }
  }

  // Classify bill type
  const billType = classifyBillType(email.subject, email.body, billTypePatterns)

  // Extract merchant name (from sender name before email)
  const merchantMatch = email.from.match(/^"?([^"<>@]+)"?\s*</)
  const merchant = merchantMatch
    ? merchantMatch[1].trim()
    : email.from.split("@")[0]

  // Determine if it's a bill based on confidence threshold
  const threshold = config.confidenceThreshold || 0.5
  const isBill = confidence >= threshold

  return {
    isBill,
    confidence: Math.min(confidence, 1),
    amount: amountInfo?.amount,
    currency: amountInfo?.currency,
    dueDate: dueDate || undefined,
    billType,
    merchant,
    reasons,
  }
}

/**
 * Recognize bills from multiple emails
 */
export function recognizeBills(
  emails: EmailContent[],
  config: GmailConfig,
): BillRecognition[] {
  return emails.map((email) => recognizeBill(email, config))
}

/**
 * Filter emails to only bills based on recognition
 */
export function filterToBills(
  emails: EmailContent[],
  config: GmailConfig,
): Array<{ email: EmailContent; recognition: BillRecognition }> {
  const results = emails.map((email) => ({
    email,
    recognition: recognizeBill(email, config),
  }))

  return results.filter(({ recognition }) => recognition.isBill)
}
