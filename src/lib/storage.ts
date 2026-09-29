import { supabase } from '../../supabase';

export const PROCESS_DOCUMENTS_BUCKET = 'process_documents';
export const PAYMENT_PROOFS_BUCKET = 'payment_proofs';

/** Validade padrão das URLs assinadas (1 hora). */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Normaliza o valor guardado no banco para o caminho do objeto dentro do bucket.
 *
 * Registros criados antes da migração 059 guardam a URL pública completa
 * (`https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<caminho>`);
 * os novos guardam apenas `<caminho>`. Os dois formatos são aceitos aqui.
 */
export function toStoragePath(bucket: string, stored?: string | null): string | null {
  const value = (stored || '').trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, '') || null;
  }

  const marker = `/object/public/${bucket}/`;
  const index = value.indexOf(marker);
  if (index === -1) return null;

  const path = value.slice(index + marker.length).split('?')[0];
  if (!path) return null;

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Gera uma URL assinada para um único objeto. Retorna null se o acesso for negado. */
export async function getSignedUrl(
  bucket: string,
  stored?: string | null,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const path = toStoragePath(bucket, stored);
  if (!path) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error(`[storage] falha ao assinar ${bucket}/${path}:`, error.message);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * Gera URLs assinadas em lote e devolve um mapa indexado pelo valor original
 * guardado no banco, para que o chamador não precise reconverter caminhos.
 */
export async function getSignedUrlMap(
  bucket: string,
  storedValues: Array<string | null | undefined>,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const pathByStored = new Map<string, string>();
  storedValues.forEach((stored) => {
    if (!stored) return;
    const path = toStoragePath(bucket, stored);
    if (path) pathByStored.set(stored, path);
  });

  const paths = [...new Set(pathByStored.values())];
  if (!paths.length) return result;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) {
    console.error(`[storage] falha ao assinar objetos de ${bucket}:`, error.message);
    return result;
  }

  const signedByPath = new Map<string, string>();
  (data || []).forEach((item) => {
    if (item.path && item.signedUrl && !item.error) {
      signedByPath.set(item.path, item.signedUrl);
    }
  });

  pathByStored.forEach((path, stored) => {
    const signed = signedByPath.get(path);
    if (signed) result.set(stored, signed);
  });

  return result;
}
