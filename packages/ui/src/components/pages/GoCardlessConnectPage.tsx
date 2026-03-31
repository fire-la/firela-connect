/**
 * GoCardless Connect Page
 *
 * Multi-step OAuth flow for connecting bank accounts via GoCardless.
 * Steps: Select Country -> Search Bank -> Authorizing -> Complete
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Landmark,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react"
import { createAdapter } from "@/adapters"
import type { GoCardlessInstitution } from "@/types/relay"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Steps } from "@/components/ui/steps"

/** EU/EEA + GB country options for bank selection */
const COUNTRY_OPTIONS = [
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "ES", name: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "IT", name: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "NL", name: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "BE", name: "Belgium", flag: "\u{1F1E7}\u{1F1EA}" },
  { code: "AT", name: "Austria", flag: "\u{1F1E6}\u{1F1F9}" },
  { code: "PT", name: "Portugal", flag: "\u{1F1F5}\u{1F1F9}" },
  { code: "IE", name: "Ireland", flag: "\u{1F1EE}\u{1F1EA}" },
  { code: "SE", name: "Sweden", flag: "\u{1F1F8}\u{1F1EA}" },
  { code: "NO", name: "Norway", flag: "\u{1F1F3}\u{1F1F4}" },
  { code: "DK", name: "Denmark", flag: "\u{1F1E9}\u{1F1F0}" },
  { code: "FI", name: "Finland", flag: "\u{1F1EB}\u{1F1EE}" },
  { code: "PL", name: "Poland", flag: "\u{1F1F5}\u{1F1F1}" },
  { code: "EE", name: "Estonia", flag: "\u{1F1EA}\u{1F1EA}" },
  { code: "LT", name: "Lithuania", flag: "\u{1F1F1}\u{1F1F9}" },
  { code: "LV", name: "Latvia", flag: "\u{1F1F1}\u{1F1FB}" },
  { code: "CZ", name: "Czech Republic", flag: "\u{1F1E8}\u{1F1FF}" },
  { code: "RO", name: "Romania", flag: "\u{1F1F7}\u{1F1F4}" },
  { code: "BG", name: "Bulgaria", flag: "\u{1F1E7}\u{1F1EC}" },
  { code: "HR", name: "Croatia", flag: "\u{1F1ED}\u{1F1F7}" },
  { code: "HU", name: "Hungary", flag: "\u{1F1ED}\u{1F1FA}" },
  { code: "IS", name: "Iceland", flag: "\u{1F1EE}\u{1F1F8}" },
  { code: "LI", name: "Liechtenstein", flag: "\u{1F1F1}\u{1F1EE}" },
  { code: "MT", name: "Malta", flag: "\u{1F1F2}\u{1F1F9}" },
  { code: "SI", name: "Slovenia", flag: "\u{1F1F8}\u{1F1EE}" },
  { code: "SK", name: "Slovakia", flag: "\u{1F1F8}\u{1F1F0}" },
  { code: "LU", name: "Luxembourg", flag: "\u{1F1F1}\u{1F1FA}" },
  { code: "GR", name: "Greece", flag: "\u{1F1EC}\u{1F1F7}" },
  { code: "CH", name: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}" },
]

/** Polling interval in milliseconds */
const POLL_INTERVAL = 2000
/** Polling timeout in milliseconds (5 minutes) */
const POLL_TIMEOUT = 5 * 60 * 1000

type StepIndex = 0 | 1 | 2 | 3

export function GoCardlessConnectPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<StepIndex>(0)
  const [country, setCountry] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [institutions, setInstitutions] = useState<GoCardlessInstitution[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<GoCardlessInstitution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    }
  }, [])

  /** Search for institutions in the selected country */
  const handleSearch = useCallback(async () => {
    if (!country) return
    setLoading(true)
    setError(null)
    try {
      const adapter = createAdapter()
      const results = await adapter.searchInstitutions(country)
      // Filter by search query if provided
      const filtered = searchQuery
        ? results.filter(
            (inst) =>
              inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              inst.bic.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : results
      setInstitutions(filtered)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search institutions")
    } finally {
      setLoading(false)
    }
  }, [country, searchQuery])

  /** Start the OAuth flow for the selected institution */
  const startOAuthFlow = useCallback(async (institution: GoCardlessInstitution) => {
    setSelectedInstitution(institution)
    setStep(2)
    setError(null)
    setPopupBlocked(false)

    try {
      const adapter = createAdapter()
      const requisition = await adapter.createRequisition(
        institution.id,
        window.location.origin + "/connect/gocardless"
      )

      // Open popup with the requisition link
      const popup = window.open(requisition.link, "_blank", "width=600,height=700")
      if (!popup || popup.closed) {
        setPopupBlocked(true)
        setError("Popup blocked. Please allow popups for this site and try again.")
        return
      }

      // Start polling for requisition status
      pollIntervalRef.current = setInterval(async () => {
        try {
          // NOTE: access_token is managed server-side via GoCardlessRelayClient.
          // The server route creates a token internally when not provided.
          const status = await adapter.pollRequisitionStatus(requisition.id, "")
          if (status.status === "DN") {
            // Done - connection successful
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
            setStep(3)
          } else if (status.status === "RJ" || status.status === "EX") {
            // Rejected or Expired
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
            setError(
              status.status === "RJ"
                ? "Bank authorization was rejected. Please try again."
                : "The authorization session has expired. Please try again."
            )
          }
        } catch (pollErr) {
          // Individual poll failures should not break the flow
          console.error("Poll error:", pollErr)
        }
      }, POLL_INTERVAL)

      // Set 5-minute timeout
      pollTimeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setError("Authorization timed out after 5 minutes. Please try again.")
      }, POLL_TIMEOUT)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authorization")
    }
  }, [])

  /** Retry opening the popup (when popup was blocked) */
  const handleRetryPopup = useCallback(() => {
    // This requires re-initiating the flow - go back to bank selection
    setStep(1)
    setError(null)
    setPopupBlocked(false)
  }, [])

  /** Reset the entire flow */
  const handleReset = useCallback(() => {
    setStep(0)
    setCountry("")
    setSearchQuery("")
    setInstitutions([])
    setSelectedInstitution(null)
    setError(null)
    setLoading(false)
    setPopupBlocked(false)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
  }, [])

  const getCountryName = (code: string) => {
    const option = COUNTRY_OPTIONS.find((c) => c.code === code)
    return option ? `${option.flag} ${option.name}` : code
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-emerald-500 to-teal-600">
      <div className="w-full max-w-lg space-y-6">
        {/* Step indicator */}
        <Steps current={step}>
          <Steps.Step title="Country" description="Select" />
          <Steps.Step title="Bank" description="Search" />
          <Steps.Step title="Authorize" description="OAuth" />
          <Steps.Step title="Complete" description="Done" />
        </Steps>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Landmark className="w-10 h-10 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Connect Your Bank</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0: Select Country */}
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Select your country to find available banks for connection.
                </p>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={!country}
                  onClick={() => setStep(1)}
                >
                  Next
                </Button>
              </div>
            )}

            {/* Step 1: Search Bank */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(0)}
                    className="text-muted-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {getCountryName(country)}
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSearch()
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Search for your bank..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                  </Button>
                </form>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching banks...</span>
                  </div>
                )}

                {!loading && institutions.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {institutions.map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => startOAuthFlow(inst)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {inst.logo ? (
                            <img
                              src={inst.logo}
                              alt={inst.name}
                              className="w-8 h-8 rounded object-contain"
                              onError={(e) => {
                                // Fallback to Landmark icon on image load error
                                const target = e.currentTarget
                                target.style.display = "none"
                                const sibling = target.nextElementSibling
                                if (sibling) (sibling as HTMLElement).style.display = "flex"
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-8 h-8 rounded bg-muted items-center justify-center ${inst.logo ? "hidden" : "flex"}`}
                          >
                            <Landmark className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{inst.name}</p>
                            <p className="text-xs text-muted-foreground">
                              BIC: {inst.bic}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end">
                            {inst.countries.slice(0, 3).map((c) => (
                              <span key={c} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && institutions.length === 0 && searchQuery && !error && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No banks found. Try a different search term.
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Authorizing */}
            {step === 2 && (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 p-4 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Waiting for {selectedInstitution?.name || "bank"}...</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please complete the authorization in the popup window.
                  The page will update automatically when done.
                </p>

                {popupBlocked && (
                  <Button variant="outline" onClick={handleRetryPopup}>
                    Retry
                  </Button>
                )}
              </div>
            )}

            {/* Step 3: Complete */}
            {step === 3 && (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Bank account connected successfully!</span>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => navigate("/connect")}
                  >
                    View Accounts
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleReset}
                  >
                    Connect Another
                  </Button>
                </div>
              </div>
            )}

            {/* Error display (for steps 1 and 2) */}
            {error && (step === 1 || step === 2) && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
