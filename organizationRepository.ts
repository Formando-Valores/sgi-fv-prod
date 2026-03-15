import { supabase } from './supabase';
import { Organization } from './types';

type PostgrestErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

const configuredSchema = import.meta.env.VITE_SUPABASE_ORG_SCHEMA?.trim();
const configuredTable = import.meta.env.VITE_SUPABASE_ORG_TABLE?.trim() || 'banco';

const candidateSchemas = Array.from(new Set([configuredSchema, 'public'].filter(Boolean))) as string[];
const candidateTables = Array.from(new Set([configuredTable, 'organizations'].filter(Boolean))) as string[];
const candidateNameColumns = ['name', 'nome', 'razao_social'];

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'organizacao';

const toOrganization = (row: Record<string, unknown>): Organization | null => {
  const idValue = row.id;

  if (idValue === null || idValue === undefined) {
    return null;
  }

  const organizationName = candidateNameColumns
    .map((column) => row[column])
    .find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

  return {
    id: String(idValue),
    name: organizationName ?? `Organização ${idValue}`,
  };
};

const isSchemaCacheError = (error: PostgrestErrorLike | null | undefined) =>
  error?.code === 'PGRST205' || error?.message?.includes('schema cache');

const isRetryableColumnError = (error: PostgrestErrorLike | null | undefined) => {
  if (!error) {
    return false;
  }

  if (error.code === 'PGRST204') {
    return true;
  }

  const normalizedMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();

  return (
    error.code === '42703' ||
    normalizedMessage.includes('column') ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes('unknown column')
  );
};

export const loadOrganizations = async () => {
  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      const { data, error } = await supabase
        .schema(schema)
        .from(table)
        .select('*')
        .limit(300);

      if (error) {
        lastError = error;

        if (isSchemaCacheError(error)) {
          continue;
        }

        if (error.code === '42P01') {
          continue;
        }

        continue;
      }

      const organizations = (data ?? [])
        .map((row) => toOrganization(row as Record<string, unknown>))
        .filter((value): value is Organization => Boolean(value))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

      return {
        organizations,
        resolvedSchema: schema,
        resolvedTable: table,
        error: null as PostgrestErrorLike | null,
      };
    }
  }

  return { organizations: [], resolvedSchema: null, resolvedTable: null, error: lastError };
};

export const createOrganization = async (organizationName: string) => {
  const normalizedName = organizationName.trim();

  if (!normalizedName) {
    return { organization: null, resolvedSchema: null, resolvedTable: null, error: { message: 'Nome da organização é obrigatório.' } };
  }

  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      for (const nameColumn of candidateNameColumns) {
        const baseSlug = slugify(normalizedName);
        const payloadVariants: Array<Record<string, unknown>> = [
          { [nameColumn]: normalizedName, slug: `${baseSlug}-${Date.now()}` },
          { [nameColumn]: normalizedName },
        ];

        for (const payload of payloadVariants) {
          const { data, error } = await supabase
            .schema(schema)
            .from(table)
            .insert([payload])
            .select('*')
            .single();

          if (error) {
            lastError = error;

            if (isRetryableColumnError(error) || isSchemaCacheError(error) || error.code === '42P01') {
              continue;
            }

            if (error.code === '42501') {
              return { organization: null, resolvedSchema: schema, resolvedTable: table, error };
            }

            if (error.code === '23505') {
              continue;
            }

            return { organization: null, resolvedSchema: schema, resolvedTable: table, error };
          }

          const organization = toOrganization((data ?? {}) as Record<string, unknown>);

          if (!organization) {
            return {
              organization: null,
              resolvedSchema: schema,
              resolvedTable: table,
              error: { message: 'Registro criado, mas sem campo id.' },
            };
          }

          return { organization, resolvedSchema: schema, resolvedTable: table, error: null as PostgrestErrorLike | null };
        }
      }
    }
  }

  return { organization: null, resolvedSchema: null, resolvedTable: null, error: lastError };
};

export const buildOrganizationErrorMessage = (error: PostgrestErrorLike | null | undefined) => {
  if (!error) {
    return 'Não foi possível processar organizações.';
  }

  if (isSchemaCacheError(error) || error.code === '42P01') {
    return `Não foi encontrada a tabela de organizações no schema esperado. Verifique VITE_SUPABASE_ORG_SCHEMA/VITE_SUPABASE_ORG_TABLE ou use a tabela padrão organizations.`;
  }

  if (error.code === '42501') {
    return 'Sem permissão para cadastrar organização. Aplique as migrations 007_organizations_insert_policy.sql e 008_organizations_insert_policy_fallback.sql no Supabase.';
  }

  if (isRetryableColumnError(error)) {
    return 'A tabela de organizações foi encontrada, mas as colunas esperadas não batem (name/nome/razao_social/slug). Revise o schema da tabela.';
  }

  if (error.code === '23502') {
    return 'A tabela exige campos obrigatórios adicionais (ex.: slug). Ajuste defaults no banco ou preencha esses campos no cadastro.';
  }

  return error.message ?? 'Erro inesperado ao processar organizações.';
};
