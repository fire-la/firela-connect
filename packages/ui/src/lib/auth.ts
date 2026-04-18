/**
 * Auth utilities for browser
 *
 * Manages JWT token storage and provides authenticated fetch wrapper.
 */

const TOKEN_KEY = "firela_auth_token"

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Store JWT token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Clear stored JWT token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Authenticated fetch wrapper
 *
 * Adds Authorization header if token is available.
 * On 401 response, clears token (caller should redirect to setup).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  if (response.status === 401 && token) {
    clearToken()
  }

  return response
}
