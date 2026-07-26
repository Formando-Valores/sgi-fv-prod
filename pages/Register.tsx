/**
 * SGI FV - Register Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Shield, Scale, Users } from 'lucide-react';
import { CONSENT_TEXT_VERSION, COUNTRIES } from '../constants';
import { ServiceUnit, ProcessStatus, User, UserRole, Organization } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';
import { buildOrganizationErrorMessage, loadOrganizations } from '../organizationRepository';
import { SUPABASE_EDGE_FUNCTIONS } from '../src/lib/supabaseFunctions';
import { calcAssociationFees, ASSOCIATION_ANNUAL_FEE } from '../src/lib/servicesCatalog';
import { createCheckoutSession } from '../src/lib/stripe';

interface RegisterProps {
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ setUsers, setCurrentUser }) => {
  const goToRoute = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    documentId: '',
    taxId: '',
    address: '',
    maritalStatus: 'Solteiro',
    country: 'Brasil',
    phone: '',
    processNumber: '',
    unit: ServiceUnit.JURIDICO,
    organizationId: '',
    consentPrivacyPolicy: false,
    consentServiceContact: false,
    consentInformativeCommunications: false,
    consentTextVersion: CONSENT_TEXT_VERSION
  });

  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm font-medium text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all hover:border-surface-300';
  const selectClass = 'w-full px-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm font-medium text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all hover:border-surface-300 appearance-none';
  const privacyPolicyUrl = import.meta.env.VITE_PRIVACY_POLICY_URL || 'https://example.com/politica-de-privacidade';

  const validatePassword = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    return hasMinLength && hasUpper && hasSpecial && hasNumber;
  };

  React.useEffect(() => {
    const fetchOrganizations = async () => {
      const { organizations: loadedOrganizations, error } = await loadOrganizations();

      if (error) {
        console.warn('[register] erro ao carregar organizações', error);
        setError(buildOrganizationErrorMessage(error));
        return;
      }

      setOrganizations(loadedOrganizations);
    };

    fetchOrganizations();
  }, []);

  const handleRegister = async () => {
    setError('');
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setError('Configuração do sistema incompleta. Contate o suporte para ajustar as variáveis do Supabase.');
      setIsLoading(false);
      return;
    }

    if (!formData.organizationId) {
      setError('Selecione a organização vinculada ao cliente.');
      setIsLoading(false);
      return;
    }

    if (!formData.consentPrivacyPolicy) {
      setError('Para concluir o cadastro, é obrigatório aceitar a Política de Privacidade e o tratamento de dados pessoais.');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      setIsLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.');
      setIsLoading(false);
      return;
    }

    try {
      console.info('[register] iniciando cadastro');

      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error('[register] falha no cadastro', authError);
        const authMessage = String(authError.message || '').toLowerCase();
        if (authMessage.includes('user already registered')) {
          setError('Este e-mail já está cadastrado. Faça login para continuar.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        const { data: selectedOrganization } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('id', formData.organizationId)
          .maybeSingle();

        const profilePayload = {
          id: data.user.id,
          nome_completo: formData.name,
          email: formData.email,
          role: UserRole.CLIENT,
          org_id: formData.organizationId,
          documento_identidade: formData.documentId,
          nif_cpf: formData.taxId,
          estado_civil: formData.maritalStatus,
          phone: formData.phone,
          endereco: formData.address,
          pais: formData.country,
        };

        let { error: profileInsertError } = await supabase
          .from('profiles')
          .insert([profilePayload]);

        if (profileInsertError) {
          const schemaMismatch =
            profileInsertError.code === 'PGRST204' ||
            String(profileInsertError.message || '').toLowerCase().includes('column');

          if (schemaMismatch) {
            const minimalProfilePayload = {
              id: data.user.id,
              nome_completo: formData.name,
              email: formData.email,
              org_id: formData.organizationId,
            };

            const { error: fallbackProfileError } = await supabase
              .from('profiles')
              .insert([minimalProfilePayload]);

            profileInsertError = fallbackProfileError;

            if (!fallbackProfileError) {
              await supabase
                .from('profiles')
                .update({ role: UserRole.CLIENT })
                .eq('id', data.user.id);
            }
          }
        }

        if (profileInsertError) {
          const duplicateProfile =
            profileInsertError.code === '23505' ||
            String(profileInsertError.message || '').toLowerCase().includes('duplicate');

          if (duplicateProfile) {
            const { error: profileUpdateError } = await supabase
              .from('profiles')
              .update({
                nome_completo: formData.name,
                email: formData.email,
                role: UserRole.CLIENT,
                org_id: formData.organizationId,
                documento_identidade: formData.documentId,
                nif_cpf: formData.taxId,
                estado_civil: formData.maritalStatus,
                phone: formData.phone,
                endereco: formData.address,
                pais: formData.country,
              })
              .eq('id', data.user.id);

            profileInsertError = profileUpdateError;
          }
        }

        if (profileInsertError) {
          console.error('[register] erro ao criar profile', profileInsertError);
          setError('Cadastro criado, mas houve falha ao criar perfil. Tente entrar novamente.');
          return;
        }

        const { error: consentInsertError } = await supabase
          .from('profile_consents')
          .insert([
            {
              profile_id: data.user.id,
              source: 'register-web',
              consent_text_version: formData.consentTextVersion,
              privacy_policy_accepted: formData.consentPrivacyPolicy,
              service_contact_accepted: formData.consentServiceContact,
              informative_comms_accepted: formData.consentInformativeCommunications,
              user_agent: navigator.userAgent || null,
            },
          ]);

        if (consentInsertError) {
          console.error('[register] erro ao registrar consentimento', consentInsertError);
          setError('Cadastro criado, mas houve falha ao registrar consentimento. Tente entrar novamente.');
          return;
        }

        const { error: membershipError } = await supabase
          .from('org_members')
          .upsert(
            {
              org_id: formData.organizationId,
              user_id: data.user.id,
              role: 'client',
            },
            { onConflict: 'org_id,user_id' }
          );

        if (membershipError) {
          const membershipStatus = String((membershipError as { code?: string; status?: number }).status ?? '');
          const membershipCode = String((membershipError as { code?: string; status?: number }).code ?? '').toLowerCase();
          const membershipMessage = String(membershipError.message || '').toLowerCase();

          const isPermissionError =
            membershipStatus === '403' ||
            membershipCode === '42501' ||
            membershipMessage.includes('permission denied') ||
            membershipMessage.includes('row-level security') ||
            membershipMessage.includes('not allowed');

          if (isPermissionError) {
            console.warn('[register] vínculo em org_members bloqueado por política; seguindo com profile.org_id', membershipError);
          } else {
            console.error('[register] erro ao criar vínculo na organização', membershipError);
            setError('Cadastro criado, mas não foi possível vincular o usuário à organização.');
            setIsLoading(false);
            return;
          }
        }

        const prefix =
          formData.unit === ServiceUnit.JURIDICO
            ? 'JURA'
            : formData.unit === ServiceUnit.ADMINISTRATIVO
              ? 'ADM'
              : 'TECAI';
        const protocol = `${prefix}-2026-00${Math.floor(Math.random() * 900) + 100}`;

        const newUser: User = {
          id: data.user.id,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: UserRole.CLIENT,
          documentId: formData.documentId,
          taxId: formData.taxId,
          address: formData.address,
          maritalStatus: formData.maritalStatus,
          country: formData.country,
          phone: formData.phone,
          processNumber: formData.processNumber,
          unit: formData.unit,
          status: ProcessStatus.PENDENTE,
          protocol,
          registrationDate: new Date().toLocaleString('pt-BR'),
          organizationId: formData.organizationId,
          organizationName: selectedOrganization?.name,
        };

        const membershipFees = calcAssociationFees(0, 'membership');
        const { data: processData, error: processErr } = await supabase
          .from('processes')
          .insert({
            org_id: formData.organizationId,
            titulo: `Filiação - ${formData.name}`,
            status: 'cadastro',
            cliente_user_id: data.user.id,
            cliente_nome: formData.name,
            origem_canal: 'registro_direto',
            os_value: ASSOCIATION_ANNUAL_FEE,
            process_status: 'aguardando_pagamento',
            association_fees: membershipFees,
          })
          .select('id')
          .single();

        let paymentUrl = '';
        if (processErr) {
          console.error('[register] erro ao criar processo', processErr);
        } else {
          try {
            const session = await createCheckoutSession({
              amount: ASSOCIATION_ANNUAL_FEE * 100,
              currency: 'brl',
              successUrl: `${window.location.origin}/#/payments/success?processId=${processData.id}`,
              cancelUrl: `${window.location.origin}/#/payments/cancel?processId=${processData.id}`,
              processId: processData.id,
              clientId: data.user.id,
              serviceId: '',
              organizationId: formData.organizationId,
              areaId: '',
              sectorId: '',
            });
            paymentUrl = session.url || '';
          } catch (stripeErr) {
            console.warn('[register] erro ao criar checkout session', stripeErr);
          }

          const loginUrl = `${window.location.origin}/#/login`;
          supabase.functions.invoke(
            SUPABASE_EDGE_FUNCTIONS.SEND_ACCESS_CREDENTIALS,
            {
              body: {
                email: formData.email,
                fullName: formData.name,
                source: 'registro_direto',
                profile: 'CLIENTE',
                temporaryPassword: formData.password ? formData.password : '********',
                loginUrl,
                ...(paymentUrl ? { paymentUrl } : {}),
              },
            }
          ).catch(() => {});
        }

        setSuccess(true);
        setTimeout(() => goToRoute('/login'), 5000);
      }
    } catch (err) {
      console.error('[register] erro inesperado', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-card border border-surface-200/60 text-center animate-scale-in">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-surface-800 mb-2">Cadastro Realizado!</h2>
          <p className="text-surface-500 text-sm leading-relaxed">Sua conta foi criada com sucesso. Enviamos um e-mail com as instruções de acesso e o link para realizar o pagamento da taxa associativa.</p>
          <div className="mt-5 p-3 bg-brand-50 border border-brand-100 rounded-xl">
            <p className="text-xs text-brand-700 font-semibold">📧 Verifique sua caixa de entrada e também a pasta de spam.</p>
          </div>
          <p className="text-surface-400 text-xs mt-6">Redirecionando para o login em 5 segundos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <img src="/icons/icon.svg" alt="" className="h-14 w-14 mb-8 brightness-0 invert" />
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
            Junte-se<br />a nós
          </h1>
          <p className="text-brand-200 text-base font-medium max-w-sm leading-relaxed">
            Crie sua conta e tenha acesso a uma plataforma completa de gestão jurídica.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Shield, text: 'Dados protegidos com criptografia' },
              { icon: Scale, text: 'Processos automatizados' },
              { icon: Users, text: 'Suporte dedicado' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-sm font-medium text-brand-100">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-screen flex flex-col p-6 sm:p-8 lg:p-12">
          {/* Mobile header */}
          <div className="lg:hidden mb-6 text-center">
            <img src="/icons/icon.svg" alt="SGI FV" className="h-10 w-10 mx-auto mb-3" />
            <h1 className="text-xl font-extrabold text-surface-800 tracking-tight">SGI FV</h1>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-surface-800">Criar Nova Conta</h2>
                  <p className="text-sm text-surface-500 mt-1">Preencha os dados abaixo para se cadastrar</p>
                </div>
                <Link
                  to="/login"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-surface-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </Link>
              </div>

              <div className="bg-white border border-surface-200/60 rounded-2xl shadow-card p-5 sm:p-7">
                <div className="space-y-6">
                  {/* Section 1 */}
                  <section>
                    <h3 className="text-brand-600 font-bold uppercase text-[11px] tracking-[0.15em] mb-3 flex items-center gap-2">
                      <span className="w-5 h-px bg-brand-500" /> 1. Dados de Identificação
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Nome Completo</label>
                        <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">E-mail para Login</label>
                        <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="exemplo@email.com" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Documento Identidade</label>
                        <input required value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Identificação Fiscal (NIF/CPF)</label>
                        <input required value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Senha</label>
                        <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Confirmar Senha</label>
                        <input type="password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className={inputClass} />
                      </div>
                    </div>
                  </section>

                  {/* Section 2 */}
                  <section>
                    <h3 className="text-brand-600 font-bold uppercase text-[11px] tracking-[0.15em] mb-3 flex items-center gap-2">
                      <span className="w-5 h-px bg-brand-500" /> 2. Contato & Morada
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Endereço Completo</label>
                        <input required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Estado Civil</label>
                        <select value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} className={selectClass}>
                          <option value="Solteiro">Solteiro</option>
                          <option value="Casado">Casado</option>
                          <option value="Divorciado">Divorciado</option>
                          <option value="Viúvo">Viúvo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">País (DDD)</label>
                        <select value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className={selectClass}>
                          {COUNTRIES.map(c => (
                            <option key={c.name} value={c.name}>{c.flag} {c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Celular / WhatsApp</label>
                        <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className={inputClass} placeholder="Ex: 11999999999" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Nº Processo Judicial (Opcional)</label>
                        <input value={formData.processNumber} onChange={e => setFormData({...formData, processNumber: e.target.value})} className={inputClass} />
                      </div>
                    </div>
                  </section>

                  {/* Section 3 */}
                  <section>
                    <h3 className="text-brand-600 font-bold uppercase text-[11px] tracking-[0.15em] mb-3 flex items-center gap-2">
                      <span className="w-5 h-px bg-brand-500" /> 3. Unidade de Atendimento
                    </h3>

                    <div className="mb-3">
                      <label className="text-xs font-semibold text-surface-600 mb-1.5 block">Organização</label>
                      <select
                        required
                        value={formData.organizationId}
                        onChange={e => setFormData({ ...formData, organizationId: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Selecione a organização</option>
                        {organizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {Object.values(ServiceUnit).map(unit => (
                        <label key={unit} className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all text-center ${formData.unit === unit ? 'bg-brand-50 border-brand-500 shadow-sm' : 'bg-white border-surface-200 hover:border-surface-300'}`}>
                          <input type="radio" name="unit" className="hidden" value={unit} checked={formData.unit === unit} onChange={() => setFormData({...formData, unit})} />
                          <p className={`text-sm font-semibold ${formData.unit === unit ? 'text-brand-700' : 'text-surface-600'}`}>{unit}</p>
                        </label>
                      ))}
                    </div>
                  </section>

                  {/* Section 4 */}
                  <section>
                    <h3 className="text-brand-600 font-bold uppercase text-[11px] tracking-[0.15em] mb-3 flex items-center gap-2">
                      <span className="w-5 h-px bg-brand-500" /> 4. Consentimentos
                    </h3>

                    <div className="border border-surface-200 rounded-xl p-4 bg-surface-50 space-y-3">
                      <p className="text-xs font-medium text-surface-600">
                        Declaro que li e aceito a Política de Privacidade, autorizando o tratamento dos meus dados pessoais para fins de cadastro e atendimento.
                      </p>
                      <a
                        href={privacyPolicyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-600 underline hover:text-brand-700"
                      >
                        Ler Política de Privacidade
                      </a>

                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <input
                            id="consentPrivacyPolicy"
                            type="checkbox"
                            checked={formData.consentPrivacyPolicy}
                            onChange={(e) => setFormData({ ...formData, consentPrivacyPolicy: e.target.checked })}
                            className="mt-0.5 h-4 w-4 border-surface-300 rounded text-brand-600 focus:ring-brand-500/20"
                          />
                          <label htmlFor="consentPrivacyPolicy" className="text-xs font-medium text-surface-600">
                            Autorizo o tratamento dos meus dados pessoais conforme a Política de Privacidade. (Obrigatório)
                          </label>
                        </div>

                        <div className="flex items-start gap-3">
                          <input
                            id="consentServiceContact"
                            type="checkbox"
                            checked={formData.consentServiceContact}
                            onChange={(e) => setFormData({ ...formData, consentServiceContact: e.target.checked })}
                            className="mt-0.5 h-4 w-4 border-surface-300 rounded text-brand-600 focus:ring-brand-500/20"
                          />
                          <label htmlFor="consentServiceContact" className="text-xs font-medium text-surface-600">
                            Autorizo contato por e-mail, telefone ou WhatsApp para tratativas de atendimento. (Opcional)
                          </label>
                        </div>

                        <div className="flex items-start gap-3">
                          <input
                            id="consentInformativeCommunications"
                            type="checkbox"
                            checked={formData.consentInformativeCommunications}
                            onChange={(e) => setFormData({ ...formData, consentInformativeCommunications: e.target.checked })}
                            className="mt-0.5 h-4 w-4 border-surface-300 rounded text-brand-600 focus:ring-brand-500/20"
                          />
                          <label htmlFor="consentInformativeCommunications" className="text-xs font-medium text-surface-600">
                            Aceito receber comunicações informativas sobre conteúdos e novidades. (Opcional)
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm"
                    onClick={handleRegister}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                        Finalizando cadastro...
                      </>
                    ) : (
                      'Cadastrar'
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center sm:hidden">
                <p className="text-sm text-surface-500">
                  Já tem conta?{' '}
                  <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                    Entrar
                  </Link>
                </p>
              </div>

              <p className="mt-8 text-center text-[10px] text-surface-400 font-medium">
                © 2026 SGI FV — Sistema de Gestão Integrada
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
