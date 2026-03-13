/**
 * Email Parser Service - Extract structured transaction data from bill emails
 *
 * Parses email content to extract amounts, dates, merchants, and line items.
 * Handles HTML tables, plain text lists, and various email formats.
 */

import type { BillRecognition } from "./bill-recognizer.js"

export interface ParsedTransaction {
  transactionId: string
  accountId: string
  date: string
  amount: number
  currency: string
  category: string[]
  merchantName: string
  paymentChannel: string
  pending: boolean
  description?: string
  lineItems?: LineItem[]
}

export interface LineItem {
  description: string
  amount: number
  quantity?: number
  date?: string
}

/**
 * Parse HTML table from email body
 * Many billing emails contain transaction data in HTML tables
 */
export function parseHTMLTable(html: string): LineItem[] | null {
  // Look for <table> elements
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi)
  if (!tableMatch) {
    return null
  }

  const lineItems: LineItem[] = []

  for (const table of tableMatch) {
    // Find all <tr> elements
    const rowMatches = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
    if (!rowMatches) {
      continue
    }

    for (const row of rowMatches) {
      // Extract <td> or <th> content
      const cellMatches = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
      if (!cellMatches || cellMatches.length < 2) {
        continue
      }

      // Clean cell content (remove HTML tags)
      const cleanCells = cellMatches.map((cell) =>
        cell.replace(/<[^>]+>/g, "").trim(),
      )

      // Look for amount in cells (contains $ or number with decimals)
      let amount = 0
      let description = ""

      for (const cell of cleanCells) {
        const amountMatch = cell.match(/\$?([0-9,]+\.\d{2})/)
        if (amountMatch && !amount) {
          amount = parseFloat(amountMatch[1].replace(/,/g, ""))
        } else if (cell && cell.length > 2 && !description) {
          description = cell
        }
      }

      if (amount > 0 && description) {
        lineItems.push({ description, amount })
      }
    }
  }

  return lineItems.length > 0 ? lineItems : null
}

/**
 * Parse plain text list from email body
 * Some bills use plain text with amounts on each line
 */
export function parseTextList(text: string): LineItem[] | null {
  const lines = text.split("\n")
  const lineItems: LineItem[] = []

  for (const line of lines) {
    // Look for lines with amounts (format: Description $XX.XX or $XX)
    // Allow alphanumeric descriptions (e.g., "Item 1")
    // Cents are optional (e.g., $20 or $20.00)
    const match = line.match(/^([A-Za-z0-9\s&]+)\s+\$?([0-9,]+(?:\.\d{2})?)/)
    if (match) {
      const description = match[1].trim()
      const amount = parseFloat(match[2].replace(/,/g, ""))
      if (amount > 0) {
        lineItems.push({ description, amount })
      }
    }
  }

  return lineItems.length > 0 ? lineItems : null
}

/**
 * Extract multiple amounts from text and return the largest
 * Useful for finding the total amount in a bill
 */
export function extractTotalAmount(text: string): number | null {
  const amounts: number[] = []

  // Match various amount formats: $123.45, 123.45 USD, etc.
  const patterns = [
    /\$\s*([0-9,]+\.\d{2})/g, // $123.45
    /([0-9,]+\.\d{2})\s*USD/gi, // 123.45 USD
    /total[:\s]+\$?\s*([0-9,]+\.\d{2})/gi, // Total: $123.45
    /amount[:\s]+\$?\s*([0-9,]+\.\d{2})/gi, // Amount: $123.45
    /balance due[:\s]+\$?\s*([0-9,]+\.\d{2})/gi, // Balance Due: $123.45
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ""))
      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount)
      }
    }
  }

  if (amounts.length === 0) {
    return null
  }

  // Return the largest amount (likely the total)
  return Math.max(...amounts)
}

/**
 * Extract currency from text
 */
export function extractCurrency(text: string): string {
  // Check more specific currency symbols first (before generic $)
  if (text.includes("C$") || /cad/i.test(text)) {
    return "CAD"
  }
  if (text.includes("A$") || /aud/i.test(text)) {
    return "AUD"
  }
  if (text.includes("€") || /eur/i.test(text)) {
    return "EUR"
  }
  if (text.includes("£") || /gbp/i.test(text)) {
    return "GBP"
  }
  if (text.includes("$") || /usd/i.test(text)) {
    return "USD"
  }
  return "USD" // Default
}

/**
 * Parse bill email into structured transaction data
 */
export function parseBillToTransaction(
  accountId: string,
  emailId: string,
  emailSubject: string,
  emailBody: string,
  emailFrom: string,
  emailDate: string,
  recognition: BillRecognition,
): ParsedTransaction {
  // Use recognition data if available
  const amount = recognition.amount
    ? Math.round(recognition.amount * 100) // Convert to cents
    : (() => {
        const totalAmount = extractTotalAmount(emailSubject + " " + emailBody)
        return totalAmount ? Math.round(totalAmount * 100) : 0
      })()

  const currency = recognition.currency || extractCurrency(emailBody)

  // Extract merchant name (prioritize recognition, then email extraction)
  const merchantMatch = emailFrom.match(/^"?([^"<>@]+)"?\s*</)
  const merchantName =
    recognition.merchant ||
    (merchantMatch ? merchantMatch[1].trim() : emailFrom.split("@")[0])

  // Extract date (prefer recognition due date, fall back to email date)
  const date = recognition.dueDate || emailDate

  // Determine category based on bill type
  const category = getCategoryForBillType(recognition.billType)

  // Parse line items if available
  let lineItems: LineItem[] | undefined
  const htmlTable = parseHTMLTable(emailBody)
  if (htmlTable) {
    lineItems = htmlTable
  } else {
    const textList = parseTextList(emailBody)
    if (textList) {
      lineItems = textList
    }
  }

  return {
    transactionId: `${accountId}_email_${emailId}`,
    accountId,
    date,
    amount,
    currency,
    category,
    merchantName,
    paymentChannel: "email",
    pending: false,
    description: emailSubject,
    lineItems,
  }
}

/**
 * Map bill type to transaction category
 */
function getCategoryForBillType(billType?: string): string[] {
  if (!billType) {
    return ["bills"]
  }

  const categoryMap: Record<string, string[]> = {
    "Credit Card": ["credit-card", "bills"],
    Utility: ["utilities", "bills"],
    Internet: ["internet", "utilities"],
    Phone: ["phone", "utilities"],
    Insurance: ["insurance", "bills"],
    Subscription: ["subscriptions", "entertainment"],
    Housing: ["housing", "rent"],
    Loan: ["loan", "debt"],
    Invoice: ["bills"],
    Receipt: ["purchases"],
  }

  return categoryMap[billType] || ["bills"]
}

/**
 * Parse multiple bill emails into transactions
 */
export function parseBillsToTransactions(
  accountId: string,
  emails: Array<{
    id: string
    subject: string
    body: string
    from: string
    date: string
  }>,
  recognitions: BillRecognition[],
): ParsedTransaction[] {
  return emails.map((email, index) =>
    parseBillToTransaction(
      accountId,
      email.id,
      email.subject,
      email.body,
      email.from,
      email.date,
      recognitions[index],
    ),
  )
}

/**
 * Extract account number from email content
 */
export function extractAccountNumber(text: string): string | undefined {
  // Common patterns for account numbers
  const patterns = [
    /account\s*(?:number|#|no\.?)[:\s]+([A-Z0-9-]{4,})/i,
    /ending\s+in\s+(\d{4})/i,
    /\*{3,}\s*(\d{4})/i, // *** 1234 or ***1234
    /card\s*(?:number|#|no\.?)[:\s]+([A-Z0-9-]{4,})/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) {
      return match[1]
    }
  }

  return undefined
}

/**
 * Extract due date from email content
 */
export function extractDueDate(text: string): string | undefined {
  // Pattern: "Due: MM/DD/YYYY" or "Due Date: January 15, 2024"
  const patterns = [
    /(?:due|payment)\s*(?:date|by)?[:\s]+([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?/i,
    /(?:due|payment)\s*(?:date|by)?[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    /(?:due|payment)\s*(?:date|by)?[:\s]+(\d{4})-(\d{1,2})-(\d{1,2})/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) {
      // Reconstruct the date string
      if (match[0].includes("/")) {
        return match[0] // Already in MM/DD/YYYY format
      }
      return match.slice(1).join(" ") // "January 15 2024" format
    }
  }

  return undefined
}
