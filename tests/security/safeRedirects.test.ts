import { describe, expect, it } from 'vitest';
import { appLoginUrl, resolveAppOrigin, safeRecoveryRedirect } from '../../supabase/functions/_shared/safeRedirects';

describe('redirecionamentos de recuperação', () => {
  const origin = 'https://sgi-fv-prod-one.vercel.app';

  it('normaliza o domínio canónico da aplicação', () => {
    expect(resolveAppOrigin('https://sgi-fv-prod-one.vercel.app/path')).toBe(origin);
    expect(resolveAppOrigin('http://sgi-fv-prod-one.vercel.app')).toBe(origin);
    expect(resolveAppOrigin('not-a-url')).toBe(origin);
  });

  it('aceita apenas recovery.html no mesmo domínio HTTPS', () => {
    expect(safeRecoveryRedirect(`${origin}/recovery.html`, origin)).toBe(`${origin}/recovery.html`);
    expect(safeRecoveryRedirect('https://attacker.example/recovery.html', origin)).toBe(`${origin}/recovery.html`);
    expect(safeRecoveryRedirect('javascript:alert(1)', origin)).toBe(`${origin}/recovery.html`);
    expect(safeRecoveryRedirect(`${origin}/other-page`, origin)).toBe(`${origin}/recovery.html`);
    expect(safeRecoveryRedirect(`${origin}/recovery.html?next=https://attacker.example#x`, origin)).toBe(`${origin}/recovery.html`);
  });

  it('não permite credenciais no URL e fixa o login na origem da aplicação', () => {
    expect(safeRecoveryRedirect('https://user:pass@sgi-fv-prod-one.vercel.app/recovery.html', origin)).toBe(`${origin}/recovery.html`);
    expect(appLoginUrl(origin)).toBe(`${origin}/#/login`);
  });
});
