/**
 * Fluxo comercial e convênio (extensão sem quebra).
 * Este módulo NÃO substitui o fluxo atual; ele adiciona estruturas e validações
 * para os novos cenários solicitados.
 */

import { supabase } from '../../supabase';
import { addProcessEvent, createProcess } from './processes';

export type AtendimentoTipo = 'normal' | 'convenio';
export type WorkflowStatus =
  | 'aguardando_pagamento'
  | 'em_preenchimento'
  | 'em_analise'
  | 'em_processamento'
  | 'concluido';

export interface ServiceCatalogItem {
  id: string;
  org_id: string;
  nome: string;
  valor_normal: number;
  valor_convenio: number | null;
  contribuicao_complementar: number;
  exige_associacao: boolean;
  prazo_dias_previsto: number | null;
}

export interface ServiceChecklistItem {
  id: string;
  service_id: string;
  titulo: string;
  obrigatorio: boolean;
  exige_documento: boolean;
}

export interface CreateServiceOrderInput {
  org_id: string;
  client_user_id: string;
  service_id: string;
  atendimento_tipo: AtendimentoTipo;
  comentarios_solicitacoes: string;
  checklist: Array<{ checklist_item_id: string; concluido: boolean }>;
  anexos: Array<{ checklist_item_id?: string | null; nome_arquivo: string; url_arquivo: string }>;
  payment_transaction_id: string;
  payment_confirmed: boolean;
  created_by: string;
}

export interface CheckoutBreakdown {
  valor_servico: number;
  contribuicao_complementar: number;
  valor_total: number;
  modo_preco: 'normal' | 'convenio';
}

export async function hasActiveAssociation(org_id: string, client_user_id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('client_associations')
    .select('id,status,valid_until')
    .eq('org_id', org_id)
    .eq('client_user_id', client_user_id)
    .eq('status', 'ativo')
    .gte('valid_until', new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

export function calculateCheckout(item: ServiceCatalogItem, atendimentoTipo: AtendimentoTipo): CheckoutBreakdown {
  const base =
    atendimentoTipo === 'convenio' && item.valor_convenio != null
      ? item.valor_convenio
      : item.valor_normal;

  const adicional = Number(item.contribuicao_complementar || 0);

  return {
    valor_servico: base,
    contribuicao_complementar: adicional,
    valor_total: base + adicional,
    modo_preco: atendimentoTipo === 'convenio' && item.valor_convenio != null ? 'convenio' : 'normal',
  };
}

function checklistCompleto(
  itensObrigatorios: ServiceChecklistItem[],
  checklist: Array<{ checklist_item_id: string; concluido: boolean }>,
  anexos: Array<{ checklist_item_id?: string | null; nome_arquivo: string; url_arquivo: string }>
) {
  const filled = new Map(checklist.map((item) => [item.checklist_item_id, item.concluido]));

  for (const item of itensObrigatorios) {
    if (!item.obrigatorio) continue;
    if (!filled.get(item.id)) return false;
    if (item.exige_documento) {
      const hasFile = anexos.some((file) => file.checklist_item_id === item.id && file.url_arquivo);
      if (!hasFile) return false;
    }
  }

  return true;
}

/**
 * Fluxo completo:
 * - valida associação (convênio)
 * - calcula checkout
 * - exige pagamento confirmado, comentários e checklist obrigatório
 * - cria pedido e processo
 * - registra histórico técnico
 */
export async function createServiceOrderWithProcess(input: CreateServiceOrderInput) {
  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('*')
    .eq('id', input.service_id)
    .eq('org_id', input.org_id)
    .maybeSingle<ServiceCatalogItem>();

  if (serviceError || !service) {
    throw new Error('Serviço não encontrado para a organização selecionada.');
  }

  if (input.atendimento_tipo === 'convenio') {
    const associado = await hasActiveAssociation(input.org_id, input.client_user_id);
    if (!associado || !service.exige_associacao) {
      throw new Error('Cliente sem associação ativa para uso de serviços de convênio.');
    }
  }

  const checkout = calculateCheckout(service, input.atendimento_tipo);

  if (!input.payment_confirmed) {
    throw new Error('Pagamento não confirmado. Processo não pode avançar.');
  }

  if (!input.comentarios_solicitacoes?.trim()) {
    throw new Error('Comentários/solicitações são obrigatórios para seguir no atendimento.');
  }

  const { data: checklistItems, error: checklistError } = await supabase
    .from('service_checklist_items')
    .select('*')
    .eq('service_id', service.id)
    .order('ordem', { ascending: true });

  if (checklistError) {
    throw new Error('Não foi possível carregar checklist obrigatório do serviço.');
  }

  const required = (checklistItems || []) as ServiceChecklistItem[];
  if (!checklistCompleto(required, input.checklist, input.anexos)) {
    throw new Error('Checklist obrigatório incompleto. Complete itens e anexos obrigatórios.');
  }

  const prazoBase = Number(service.prazo_dias_previsto || 0);
  const prazoPrevisto = prazoBase > 0 ? new Date(Date.now() + prazoBase * 24 * 60 * 60 * 1000).toISOString() : null;

  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .insert({
      org_id: input.org_id,
      client_user_id: input.client_user_id,
      service_id: input.service_id,
      atendimento_tipo: input.atendimento_tipo,
      payment_transaction_id: input.payment_transaction_id,
      payment_confirmed: input.payment_confirmed,
      comentarios_solicitacoes: input.comentarios_solicitacoes,
      valor_servico: checkout.valor_servico,
      contribuicao_complementar: checkout.contribuicao_complementar,
      valor_total: checkout.valor_total,
      workflow_status: 'em_analise',
      prazo_previsto: prazoPrevisto,
      created_by: input.created_by,
    })
    .select('id')
    .single();

  if (orderError || !order?.id) {
    throw new Error('Falha ao criar pedido de atendimento.');
  }

  await supabase.from('service_order_checklist').insert(
    input.checklist.map((item) => ({
      order_id: order.id,
      checklist_item_id: item.checklist_item_id,
      concluido: item.concluido,
    }))
  );

  if (input.anexos.length > 0) {
    await supabase.from('service_order_attachments').insert(
      input.anexos.map((file) => ({
        order_id: order.id,
        checklist_item_id: file.checklist_item_id || null,
        nome_arquivo: file.nome_arquivo,
        url_arquivo: file.url_arquivo,
      }))
    );
  }

  const process = await createProcess(
    input.org_id,
    {
      titulo: `Atendimento - ${service.nome}`,
      cliente_contato: input.client_user_id,
      origem_canal: input.atendimento_tipo === 'convenio' ? 'convênio' : 'comercial',
      org_nome_solicitado: service.nome,
    },
    input.created_by
  );

  const technicalEvents = [
    `Serviço selecionado: ${service.nome} (${checkout.modo_preco})`,
    `Pagamento confirmado. Transação: ${input.payment_transaction_id}`,
    `Comentários adicionados pelo cliente`,
    `Checklist validado com ${input.checklist.length} item(ns)`,
    `Documentos anexados: ${input.anexos.length}`,
    `Prazo previsto definido: ${prazoPrevisto || 'não definido'}`,
    `Envio automático para processamento`,
  ];

  for (const message of technicalEvents) {
    await addProcessEvent(input.org_id, process.id, 'observacao', message, input.created_by);
    await supabase.from('technical_history').insert({
      org_id: input.org_id,
      process_id: process.id,
      order_id: order.id,
      event_type: 'workflow',
      message,
      created_by: input.created_by,
    });
  }

  return { order_id: order.id, process_id: process.id, checkout };
}

