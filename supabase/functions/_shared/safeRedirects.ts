/** URL de recuperação: apenas o domínio canónico da aplicação e a rota estática recovery.html. */
const DEFAULT_APP_ORIGIN = 'https://sgi-fv-prod-one.vercel.app';

export function resolveAppOrigin(configuredOrigin?: string | null): string {
  try {
    const url = new URL(String(configuredOrigin ?? DEFAULT_APP_ORIGIN));
    if (url.protocol !== 'https:' || url.username || url.password) return DEFAULT_APP_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export function safeRecoveryRedirect(candidate: string | null | undefined, appOrigin: string): string {
  const origin = resolveAppOrigin(appOrigin);
  const fallback = new URL('/recovery.html', origin).toString();
  if (!candidate?.trim()) return fallback;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.origin !== origin || url.pathname !== '/recovery.html' || url.username || url.password) {
      return fallback;
    }
    // Não transportar query/hash controlados pelo pedido para a página de recuperação.
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return fallback;
  }
}

export function appLoginUrl(appOrigin: string): string {
  return `${resolveAppOrigin(appOrigin)}/#/login`;
}
