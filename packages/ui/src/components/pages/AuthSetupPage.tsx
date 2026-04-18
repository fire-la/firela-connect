/**
 * Auth Setup Page
 *
 * Login/setup page for JWT authentication.
 * On fresh deployment, accepts any password and locks it.
 * On subsequent visits, requires the stored password.
 */
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { KeyRound, Loader2, AlertCircle } from "lucide-react"
import { setToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export function AuthSetupPage() {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const redirectTo = searchParams.get("redirect") || "/"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      })

      const data = await res.json() as {
        success?: boolean
        token?: string
        error?: string
      }

      if (data.success && data.token) {
        setToken(data.token)
        navigate(redirectTo, { replace: true })
      } else {
        setError(data.error || "Authentication failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Sign In</h1>
          <p className="text-sm text-muted-foreground">
            Enter your setup password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Setup password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!password.trim() || loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Sign In
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          First time? Your password will be set automatically.
        </p>
      </div>
    </div>
  )
}
