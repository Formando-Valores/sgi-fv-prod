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

const buildPayloadVariants = (organizationName: string, organizationId: string, nameColumn: string) => {
  const baseSlug = slugify(organizationName);

  return [
    { id: organizationId, [nameColumn]: organizationName, slug: `${baseSlug}-${Date.now()}` },
    { id: organizationId, [nameColumn]: organizationName },
  ] as Array<Record<string, unknown>>;
};

export const loadOrganizations = async () => {
  let lastError: PostgrestErrorLike | null = null;
  const mergedOrganizations = new Map<string, Organization>();

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      const { data, error } = await supabase
        .schema(schema)
        .from(table)
        .select('*')
        .limit(500);

      if (error) {
        lastError = error;
        continue;
      }

      for (const row of data ?? []) {
        const organization = toOrganization(row as Record<string, unknown>);

        if (!organization) {
          continue;
        }

        if (!mergedOrganizations.has(organization.id)) {
          mergedOrganizations.set(organization.id, organization);
        }
      }
    }
  }

  if (mergedOrganizations.size > 0) {
    return {
      organizations: Array.from(mergedOrganizations.values()).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
      resolvedSchema: null,
      resolvedTable: null,
      error: null as PostgrestErrorLike | null,
    };
  }

  return { organizations: [], resolvedSchema: null, resolvedTable: null, error: lastError };
};

export const createOrganization = async (organizationName: string) => {
  const normalizedName = organizationName.trim();

  if (!normalizedName) {
    return { organization: null, resolvedSchema: null, resolvedTable: null, error: { message: 'Nome da organização é obrigatório.' } };
  }

  let lastError: PostgrestErrorLike | null = null;
  let permissionError: { error: PostgrestErrorLike; schema: string; table: string } | null = null;

  const userResult = await supabase.auth.getUser();
  const authenticatedUserId = userResult.data.user?.id ?? null;

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      for (const nameColumn of candidateNameColumns) {
        const organizationId = crypto.randomUUID();

        for (const payload of buildPayloadVariants(normalizedName, organizationId, nameColumn)) {
          const { error } = await supabase
            .schema(schema)
            .from(table)
            .insert([payload]);

          if (error) {
            lastError = error;

            if (isRetryableColumnError(error) || isSchemaCacheError(error) || error.code === '42P01' || error.code === '23505') {
              continue;
            }

            if (error.code === '42501') {
              permissionError = { error, schema, table };
              continue;
            }

            return { organization: null, resolvedSchema: schema, resolvedTable: table, error };
          }

          if (table === 'organizations' && authenticatedUserId) {
            const { error: memberError } = await supabase
              .schema(schema)
              .from('org_members')
              .upsert(
                [{ org_id: organizationId, user_id: authenticatedUserId, role: 'owner' }],
                { onConflict: 'org_id,user_id' }
              );

            if (memberError) {
              console.warn('[organizacoes] organização criada, mas falhou ao vincular owner em org_members', {
                schema,
                organizationId,
                userId: authenticatedUserId,
                error: memberError,
              });
            }
          }

          return {
            organization: {
              id: organizationId,
              name: normalizedName,
            },
            resolvedSchema: schema,
            resolvedTable: table,
            error: null as PostgrestErrorLike | null,
          };
        }
      }
    }
  }

  if (permissionError) {
    return {
      organization: null,
      resolvedSchema: permissionError.schema,
      resolvedTable: permissionError.table,
      error: permissionError.error,
    };
  }

  return { organization: null, resolvedSchema: null, resolvedTable: null, error: lastError };
};

export const updateOrganization = async (organizationId: string, organizationName: string) => {
  const normalizedName = organizationName.trim();

  if (!normalizedName) {
    return { error: { message: 'Nome da organização é obrigatório.' } as PostgrestErrorLike };
  }

  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      for (const nameColumn of candidateNameColumns) {
        const { error } = await supabase
          .schema(schema)
          .from(table)
          .update({ [nameColumn]: normalizedName })
          .eq('id', organizationId);

        if (error) {
          lastError = error;

          if (isRetryableColumnError(error) || isSchemaCacheError(error) || error.code === '42P01') {
            continue;
          }

          return { error };
        }

        return { error: null as PostgrestErrorLike | null };
      }
    }
  }

  return { error: lastError };
};

export const deleteOrganization = async (organizationId: string) => {
  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    for (const table of candidateTables) {
      const { error } = await supabase
        .schema(schema)
        .from(table)
        .delete()
        .eq('id', organizationId);

      if (error) {
        lastError = error;

        if (isSchemaCacheError(error) || error.code === '42P01') {
          continue;
        }

        return { error };
      }

      return { error: null as PostgrestErrorLike | null };
    }
  }

  return { error: lastError };
};

export const buildOrganizationErrorMessage = (error: PostgrestErrorLike | null | undefined) => {
  if (!error) {
    return 'Não foi possível processar organizações.';
  }

  if (isSchemaCacheError(error) || error.code === '42P01') {
    return 'Não foi encontrada a tabela de organizações no schema esperado. Verifique VITE_SUPABASE_ORG_SCHEMA/VITE_SUPABASE_ORG_TABLE ou use a tabela padrão organizations.';
  }

  if (error.code === '42501') {
    return 'Sem permissão para cadastrar organização. Verifique as policies RLS de INSERT em organizations e de UPSERT em org_members para o usuário autenticado.';
  }

  if (isRetryableColumnError(error)) {
    return 'A tabela de organizações foi encontrada, mas as colunas esperadas não batem (name/nome/razao_social/slug). Revise o schema da tabela.';
  }

  if (error.code === '23503') {
    return 'Não foi possível excluir a organização porque há vínculos ativos (membros, perfis ou outros registros). Remova os vínculos antes de excluir.';
  }

  if (error.code === '23502') {
    return 'A tabela exige campos obrigatórios adicionais (ex.: slug). Ajuste defaults no banco ou preencha esses campos no cadastro.';
  }

  return error.message ?? 'Erro inesperado ao processar organizações.';
};
