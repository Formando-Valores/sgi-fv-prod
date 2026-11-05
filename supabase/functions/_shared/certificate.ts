/**
 * Regras puras do certificado de filiação (MISSÃO 002).
 * Sem imports Deno/npm para poderem ser testadas com vitest.
 */

export const ASSOCIACAO_NIPC = '519206550';
export const ASSOCIACAO_SEAL_FILE = 'selo associação.png';

const PLACEHOLDER_NIPC = /^(x+|0+|-+|n\/?a)$/i;

export function isAssociacaoOrg(name?: string | null, slug?: string | null): boolean {
  return /injusti/i.test(String(name ?? '')) || /injusti/i.test(String(slug ?? ''));
}

/**
 * NIPC a imprimir no certificado.
 * - Usa SEMPRE o NIPC da própria organização quando válido.
 * - Só a Associação contra as Injustiças recorre ao NIPC 519206550 por omissão.
 * - Outras organizações sem NIPC configurado → null (o certificado omite o número
 *   em vez de imprimir o NIPC de outra entidade, como acontecia antes).
 */
export function resolveOrgNipc(org: { name?: string | null; slug?: string | null; certificate_nipc?: string | null }): string | null {
  const raw = String(org.certificate_nipc ?? '').trim();
  if (raw && !PLACEHOLDER_NIPC.test(raw)) return raw;
  return isAssociacaoOrg(org.name, org.slug) ? ASSOCIACAO_NIPC : null;
}

/** Selo/carimbo: o configurado na org; a Associação usa o seu selo por omissão. */
export function resolveSealImage(org: { name?: string | null; slug?: string | null; certificate_seal_url?: string | null }): string | null {
  const v = String(org.certificate_seal_url ?? '').trim();
  if (v) return v;
  return isAssociacaoOrg(org.name, org.slug) ? ASSOCIACAO_SEAL_FILE : null;
}

/** Logotipo do cabeçalho: certificate_logo_url → selo da própria org → nenhum. */
export function resolveLogoImage(org: {
  name?: string | null;
  slug?: string | null;
  certificate_logo_url?: string | null;
  certificate_seal_url?: string | null;
}): string | null {
  const v = String(org.certificate_logo_url ?? '').trim();
  if (v) return v;
  return resolveSealImage(org);
}

/**
 * Constrói o URL público de uma imagem: aceita URL absoluto (https://...) ou
 * nome de ficheiro servido em `${appUrl}/img/`.
 */
export function imageUrl(appUrl: string, fileOrUrl: string): string {
  const v = String(fileOrUrl ?? '').trim();
  if (/^https:\/\//i.test(v)) return v;
  const name = v.replace(/^\/?img\//, '').replace(/^\//, '');
  return `${String(appUrl ?? '').replace(/\/$/, '')}/img/${encodeURIComponent(name)}`;
}
