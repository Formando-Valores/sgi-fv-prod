import { defineConfig } from 'vitest/config';

// Testes automáticos (MISSÃO 002): lógica pura de autorização, preço e certificado
// partilhada entre as Edge Functions (Deno) e o frontend.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
