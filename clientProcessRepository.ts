import { ProcessStatus } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

export type DocumentType = 'Bilhete de Identidade' | 'Cartão de Cidadão' | 'Passaporte';
export type MaritalStatus = 'Solteiro' | 'Casado' | 'Divorciado' | 'Viúvo' | 'União de Facto';
export type AssociationType = 'Cliente' | 'Prestador de Serviços';

export interface ClientRegistrationPayload {
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  taxIdentifier: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  maritalStatus: MaritalStatus;
  profession: string;
  nationality: string;
  associationType: AssociationType;
  organizationId?: string;
  createdByUserId?: string;
}

export interface CreatedClientProcessResult {
  clientId: string;
  processId: string;
  processNumber: string;
}

const PROCESS_PREFIX = 'SIGA-FV';

const sanitizeDigits = (value: string): string => value.replace(/\D/g, '');

export const generateProcessNumber = (year: number, sequential: number): string => {
  const safeSequential = Math.max(1, sequential);
  return `${PROCESS_PREFIX}-${year}-${String(safeSequential).padStart(6, '0')}`;
};

const parseProcessSequence = (processNumber: string, year: number): number => {
  const expectedPrefix = `${PROCESS_PREFIX}-${year}-`;

  if (!processNumber.startsWith(expectedPrefix)) {
    return 0;
  }

  const sequencePart = processNumber.slice(expectedPrefix.length);
  const parsed = Number.parseInt(sequencePart, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNextProcessSequence = async (year: number): Promise<number> => {
  const likePattern = `${PROCESS_PREFIX}-${year}-%`;

  const { data, error } = await supabase
    .from('processes')
    .select('process_number')
    .ilike('process_number', likePattern)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Erro ao buscar sequencial de processos: ${error.message}`);
  }

  const currentMax = Math.max(
    0,
    ...(data ?? []).map((row) => parseProcessSequence(row.process_number ?? '', year)),
  );

  return currentMax + 1;
};

export const createClientAndProcess = async (payload: ClientRegistrationPayload): Promise<CreatedClientProcessResult> => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não está configurado.');
  }

  const year = new Date().getFullYear();
  const sequential = await getNextProcessSequence(year);
  const processNumber = generateProcessNumber(year, sequential);

  const { data: createdClient, error: clientError } = await supabase
    .from('clients')
    .insert({
      full_name: payload.fullName.trim(),
      document_type: payload.documentType,
      document_number: payload.documentNumber.trim(),
      tax_identifier: payload.taxIdentifier.trim(),
      address: payload.address.trim(),
      postal_code: payload.postalCode.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim().toLowerCase(),
      marital_status: payload.maritalStatus,
      profession: payload.profession.trim(),
      nationality: payload.nationality.trim(),
      association_type: payload.associationType,
      organization_id: payload.organizationId ?? null,
      created_by: payload.createdByUserId ?? null,
    })
    .select('id')
    .single();

  if (clientError || !createdClient) {
    throw new Error(`Erro ao criar cliente: ${clientError?.message ?? 'registro não retornado'}`);
  }

  const { data: createdProcess, error: processError } = await supabase
    .from('processes')
    .insert({
      client_id: createdClient.id,
      process_number: processNumber,
      status: ProcessStatus.PENDENTE,
      organization_id: payload.organizationId ?? null,
      assigned_to: payload.createdByUserId ?? null,
      created_by: payload.createdByUserId ?? null,
    })
    .select('id')
    .single();

  if (processError || !createdProcess) {
    throw new Error(`Erro ao criar processo automático: ${processError?.message ?? 'registro não retornado'}`);
  }

  const historyError = await supabase
    .from('process_history')
    .insert({
      process_id: createdProcess.id,
      action: 'CADASTRO_AUTOMATICO',
      description: 'Processo criado automaticamente após envio do formulário eletrônico.',
      created_by: payload.createdByUserId ?? null,
    })
    .then(({ error }) => error)
    .catch(() => null);

  if (historyError) {
    // mantém fluxo principal mesmo com histórico falhando
    console.warn('[clients] não foi possível salvar histórico inicial do processo', historyError.message);
  }

  return {
    clientId: createdClient.id,
    processId: createdProcess.id,
    processNumber,
  };
};

export const buildClientRegistrationErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('duplicate')) {
      return 'Já existe cadastro com os dados informados.';
    }

    if (error.message.toLowerCase().includes('permission')) {
      return 'Sem permissão para cadastrar cliente/processo nesta organização.';
    }

    return error.message;
  }

  return 'Erro inesperado ao cadastrar cliente e gerar processo.';
};

export const normalizeDocumentNumber = (value: string): string => sanitizeDigits(value);
