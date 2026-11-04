// Note: localStorage tokens are readable by any XSS, acceptable for this MVP, to be revisited.

const TOKEN_KEY = 'travalastic_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Gracefully handle private browsing / disabled localStorage / quota exceeded
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Gracefully handle private browsing / disabled localStorage
  }
}

