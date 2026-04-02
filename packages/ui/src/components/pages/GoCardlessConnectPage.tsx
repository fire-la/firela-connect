/**
 * GoCardless Connect Page
 *
 * Displays an "unavailable" notice since GoCardless Bank Account Data
 * stopped accepting new accounts (July 2025).
 */
import { useNavigate } from "react-router-dom"
import { Landmark, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function GoCardlessConnectPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-emerald-500 to-teal-600">
      <div className="w-full max-w-lg space-y-6">
        {/* Unavailable notice */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Landmark className="w-10 h-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Connect Your Bank</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-center space-y-2">
              <p className="font-medium text-muted-foreground">Temporarily Unavailable</p>
              <p className="text-sm text-muted-foreground">
                GoCardless Bank Account Data is no longer accepting new accounts.
                This feature is temporarily disabled.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/connect")} className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
