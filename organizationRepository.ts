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
const configuredNameColumn = import.meta.env.VITE_SUPABASE_ORG_NAME_COLUMN?.trim();

const candidateSchemas = Array.from(new Set([configuredSchema, 'public'].filter(Boolean))) as string[];
const candidateNameColumns = Array.from(
  new Set([configuredNameColumn, 'name', 'nome', 'razao_social'].filter(Boolean))
) as string[];


const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'organizacao';


const pickDate = (row: Record<string, unknown>, candidates: string[]) => {
  for (const candidate of candidates) {
    const value = row[candidate];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

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
    createdAt: pickDate(row, ['created_at', 'createdAt', 'inserted_at']),
    subscriptionExpiresAt: pickDate(row, ['subscription_expires_at', 'expires_at', 'subscription_ends_at', 'expiresAt']),
    slug: typeof row.slug === 'string' ? row.slug : undefined,
    active: typeof row.active === 'boolean' ? row.active : undefined,
  };
};

const isSchemaCacheError = (error: PostgrestErrorLike | null | undefined) =>
  error?.code === 'PGRST205' || error?.message?.includes('schema cache');

export const loadOrganizations = async () => {
  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    const { data, error } = await supabase
      .schema(schema)
      .from(configuredTable)
      .select('*')
      .limit(300);

    if (error) {
      lastError = error;
      continue;
    }

    const organizations = (data ?? [])
      .map((row) => toOrganization(row as Record<string, unknown>))
      .filter((value): value is Organization => Boolean(value))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

    return { organizations, resolvedSchema: schema, error: null as PostgrestErrorLike | null };
  }

  return { organizations: [], resolvedSchema: null, error: lastError };
};

export const createOrganization = async (organizationName: string) => {
  const normalizedName = organizationName.trim();

  if (!normalizedName) {
    return { organization: null, resolvedSchema: null, error: { message: 'Nome da organização é obrigatório.' } };
  }

  let lastError: PostgrestErrorLike | null = null;

  for (const schema of candidateSchemas) {
    for (const nameColumn of candidateNameColumns) {
      const baseSlug = slugify(normalizedName);
      const payloadVariants: Array<Record<string, unknown>> = [
        { [nameColumn]: normalizedName, slug: `${baseSlug}-${Date.now()}` },
        { [nameColumn]: normalizedName },
      ];

      for (const payload of payloadVariants) {
        const { data, error } = await supabase
          .schema(schema)
          .from(configuredTable)
          .insert([payload])
          .select('*')
          .single();

        if (error) {
          lastError = error;

          // Quando a coluna não existe no schema (nome/slug), tentamos o próximo formato/coluna.
          if (error.code === 'PGRST204') {
            continue;
          }

          // Permissão negada (RLS/policy) deve ser retornada imediatamente.
          if (error.code === '42501') {
            return { organization: null, resolvedSchema: schema, error };
          }

          // Para qualquer outro erro não relacionado à coluna, retornamos logo para não mascarar causa raiz.
          return { organization: null, resolvedSchema: schema, error };
        }

        const organization = toOrganization((data ?? {}) as Record<string, unknown>);

        if (!organization) {
          return {
            organization: null,
            resolvedSchema: schema,
            error: { message: 'Registro criado, mas sem campo id.' },
          };
        }

        return { organization, resolvedSchema: schema, error: null as PostgrestErrorLike | null };
      }

      continue;
    }

  }

  return { organization: null, resolvedSchema: null, error: lastError };
};





export const updateOrganizationActiveStatus = async (organizationId: string, active: boolean) => {
  if (!organizationId) {
    return {
      error: { message: 'ID da organização é obrigatório para atualizar status.' } as PostgrestErrorLike | null,
      updated: false,
    };
  }

  for (const schema of candidateSchemas) {
    const { error } = await supabase
      .schema(schema)
      .from(configuredTable)
      .update({ active })
      .eq('id', organizationId);

    if (!error) {
      return { error: null as PostgrestErrorLike | null, updated: true };
    }

    if (error.code === 'PGRST205') {
      continue;
    }

    return { error, updated: false };
  }

  return {
    error: { message: 'Não foi possível atualizar status da organização no schema configurado.' } as PostgrestErrorLike,
    updated: false,
  };
};

export const deleteOrganization = async (organizationId: string) => {
  if (!organizationId) {
    return {
      error: { message: 'ID da organização é obrigatório para excluir.' } as PostgrestErrorLike | null,
      deleted: false,
    };
  }

  for (const schema of candidateSchemas) {
    const { data, error } = await supabase
      .schema(schema)
      .from(configuredTable)
      .delete()
      .eq('id', organizationId)
      .select('id')
      .limit(1);

    if (!error) {
      const deleted = Array.isArray(data) && data.length > 0;

      if (!deleted) {
        return {
          error: {
            code: 'NO_ROWS_DELETED',
            message: 'A exclusão foi bloqueada por política do banco ou o registro não existe mais.',
          } as PostgrestErrorLike,
          deleted: false,
        };
      }

      return { error: null as PostgrestErrorLike | null, deleted: true };
    }

    if (error.code === 'PGRST205') {
      continue;
    }

    return { error, deleted: false };
  }

  return {
    error: { message: 'Não foi possível excluir organização no schema configurado.' } as PostgrestErrorLike,
    deleted: false,
  };
};

export const buildOrganizationErrorMessage = (error: PostgrestErrorLike | null | undefined) => {
  if (!error) {
    return 'Não foi possível processar organizações.';
  }

  if (isSchemaCacheError(error)) {
    return `Não foi encontrada a tabela ${configuredTable} no schema esperado. Configure VITE_SUPABASE_ORG_SCHEMA com o schema correto no Vercel.`;
  }

  if (error.code === '42501') {
    return 'Sem permissão para cadastrar organização. Ajuste as políticas RLS de INSERT na tabela de organizações.';
  }

  if (error.code === 'PGRST204') {
    return 'A tabela de organizações foi encontrada, mas a coluna de nome esperada não existe. Verifique se há uma coluna nome/name.';
  }

  if (error.code === '23502') {
    return 'A tabela exige campos obrigatórios adicionais (ex.: slug). Ajuste defaults no banco ou preencha esses campos no cadastro.';
  }

  if (error.code === 'NO_ROWS_DELETED') {
    return 'A organização não foi excluída no banco. Verifique as políticas RLS de DELETE da tabela organizations.';
  }

  if (error.code === 'NO_ROWS_UPDATED') {
    return 'O status da organização não foi atualizado no banco. Verifique as políticas RLS de UPDATE da tabela organizations.';
  }

  return error.message ?? 'Erro inesperado ao processar organizações.';
};
