import { describe, expect, it } from 'vitest';
import {
  amountToMinorUnits,
  checkPaidAmount,
  computeProcessAmountBRL,
  formatMoney,
  minorToMajor,
  safeRedirectUrl,
  DEFAULT_ALLOWED_CHECKOUT_ORIGINS,
  DEFAULT_APP_ORIGIN,
} from '../../supabase/functions/_shared/pricing';
import { amountToMinorUnits as frontendAmountToMinorUnits } from '../../src/lib/stripeCurrency';

describe('R-05 · preço calculado no servidor', () => {
  it('converte BRL para centavos e EUR com a taxa fixa 6', () => {
    expect(amountToMinorUnits(180, 'brl')).toBe(18000);
    expect(amountToMinorUnits(180, 'eur')).toBe(3000);
    expect(amountToMinorUnits(180, 'EUR')).toBe(3000);
    expect(amountToMinorUnits(99.99, 'usd')).toBe(9999);
  });

  it('é idêntico à conversão usada no frontend (sem divergência de valores)', () => {
    for (const v of [0, 1, 50, 180, 333.33, 1250.5]) {
      for (const c of ['brl', 'eur', 'usd']) {
        expect(amountToMinorUnits(v, c)).toBe(frontendAmountToMinorUnits(v, c));
      }
    }
  });

  it('usa os_value do processo e ignora valores inválidos', () => {
    expect(computeProcessAmountBRL({ os_value: 180 })).toBe(180);
    expect(computeProcessAmountBRL({ os_value: '250.50' })).toBe(250.5);
    expect(computeProcessAmountBRL({ os_value: 0, amount: 90 })).toBe(90);
    expect(computeProcessAmountBRL({ os_value: null, amount: null })).toBe(0);
    expect(computeProcessAmountBRL({ os_value: -10 })).toBe(0);
    expect(computeProcessAmountBRL(null)).toBe(0);
  });

  it('formata valores para alertas', () => {
    expect(minorToMajor(3000)).toBe(30);
    expect(formatMoney(30, 'eur')).toBe('30,00 EUR');
  });
});

describe('R-05 · webhook confere o valor pago', () => {
  it('aceita quando valor e moeda coincidem', () => {
    expect(checkPaidAmount({ expectedMinor: 3000, expectedCurrency: 'EUR', receivedMinor: 3000, receivedCurrency: 'eur' }).ok).toBe(true);
  });

  it('recusa valor inferior (ex.: navegador manipulado para 1 cêntimo)', () => {
    const r = checkPaidAmount({ expectedMinor: 3000, expectedCurrency: 'eur', receivedMinor: 1, receivedCurrency: 'eur' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('amount_mismatch');
  });

  it('recusa moeda diferente', () => {
    const r = checkPaidAmount({ expectedMinor: 3000, expectedCurrency: 'eur', receivedMinor: 3000, receivedCurrency: 'brl' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('currency_mismatch');
  });

  it('recusa quando não há valor esperado ou recebido', () => {
    expect(checkPaidAmount({ expectedMinor: null, expectedCurrency: 'eur', receivedMinor: 3000, receivedCurrency: 'eur' }).reason).toBe('missing_expected');
    expect(checkPaidAmount({ expectedMinor: 3000, expectedCurrency: 'eur', receivedMinor: null, receivedCurrency: 'eur' }).reason).toBe('missing_received');
  });
});

describe('Checkout · URLs de retorno', () => {
  const allowed = ['https://sgi-fv-prod.vercel.app'];
  const fallback = 'https://sgi-fv-prod.vercel.app/#/payments/success';
  it('aceita a origem da aplicação', () => {
    expect(safeRedirectUrl('https://sgi-fv-prod.vercel.app/#/payments/success?processId=1', allowed, fallback))
      .toBe('https://sgi-fv-prod.vercel.app/#/payments/success?processId=1');
  });
  it('rejeita origens externas (redirecionamento aberto)', () => {
    expect(safeRedirectUrl('https://evil.example/phish', allowed, fallback)).toBe(fallback);
    expect(safeRedirectUrl('javascript:alert(1)', allowed, fallback)).toBe(fallback);
    expect(safeRedirectUrl('', allowed, fallback)).toBe(fallback);
  });
});

describe('Checkout · origens permitidas por omissão', () => {
  it('inclui o domínio novo, o antigo e o site vainaai.pt', () => {
    expect(DEFAULT_APP_ORIGIN).toBe('https://sgi-fv-prod-one.vercel.app');
    expect(DEFAULT_ALLOWED_CHECKOUT_ORIGINS).toEqual(expect.arrayContaining([
      'https://sgi-fv-prod-one.vercel.app',
      'https://sgi-fv-prod.vercel.app',
      'https://www.vainaai.pt',
      'https://vainaai.pt',
    ]));
    const fb = `${DEFAULT_APP_ORIGIN}/#/payments/success`;
    expect(safeRedirectUrl('https://vainaai.pt/obrigado', DEFAULT_ALLOWED_CHECKOUT_ORIGINS, fb)).toBe('https://vainaai.pt/obrigado');
    expect(safeRedirectUrl('https://sgi-fv-prod-one.vercel.app/#/payments/success?processId=1', DEFAULT_ALLOWED_CHECKOUT_ORIGINS, fb))
      .toBe('https://sgi-fv-prod-one.vercel.app/#/payments/success?processId=1');
  });
});
