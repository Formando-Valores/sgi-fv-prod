import { describe, expect, it } from 'vitest';
import {
  ASSOCIACAO_NIPC,
  imageUrl,
  resolveLogoImage,
  resolveOrgNipc,
  resolveSealImage,
} from '../../supabase/functions/_shared/certificate';

describe('Certificado · NIPC da organização', () => {
  it('usa o NIPC configurado da própria organização', () => {
    expect(resolveOrgNipc({ name: 'Formando Valores', certificate_nipc: '123456789' })).toBe('123456789');
  });

  it('não imprime o NIPC da Associação noutra organização sem NIPC', () => {
    expect(resolveOrgNipc({ name: 'Formando Valores', certificate_nipc: null })).toBeNull();
    expect(resolveOrgNipc({ name: 'Formando Valores', certificate_nipc: 'XXXXXXXX' })).toBeNull();
  });

  it('a Associação contra as Injustiças recorre ao seu NIPC 519206550', () => {
    expect(resolveOrgNipc({ name: 'Associação contra as Injustiças - AI', certificate_nipc: 'XXXXXXXX' })).toBe(ASSOCIACAO_NIPC);
    expect(resolveOrgNipc({ name: 'AI', slug: 'associacao-contra-injusticas', certificate_nipc: null })).toBe(ASSOCIACAO_NIPC);
  });
});

describe('Certificado · logotipo e selo', () => {
  it('usa o logotipo configurado e, se vazio, o selo da organização', () => {
    expect(resolveLogoImage({ name: 'X', certificate_logo_url: 'logo-x.png', certificate_seal_url: 'selo-x.png' })).toBe('logo-x.png');
    expect(resolveLogoImage({ name: 'X', certificate_logo_url: null, certificate_seal_url: 'selo-x.png' })).toBe('selo-x.png');
  });

  it('não usa o selo da Associação noutras organizações', () => {
    expect(resolveSealImage({ name: 'Formando Valores', certificate_seal_url: null })).toBeNull();
    expect(resolveLogoImage({ name: 'Formando Valores' })).toBeNull();
    expect(resolveSealImage({ name: 'Associação contra as Injustiças - AI' })).toBe('selo associação.png');
  });

  it('constrói URLs de imagem (ficheiro em /img ou https)', () => {
    const base = ['https:', '', 'app.example'].join('/');
    const cdn = ['https:', '', 'cdn.example', 'l.png'].join('/');
    expect(imageUrl(`${base}/`, 'selo associação.png')).toBe(`${base}/img/${encodeURIComponent('selo associação.png')}`);
    expect(imageUrl(base, '/img/logo.png')).toBe(`${base}/img/logo.png`);
    expect(imageUrl(base, cdn)).toBe(cdn);
  });
});
