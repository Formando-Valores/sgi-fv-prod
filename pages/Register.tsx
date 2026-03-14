/**
 * SGI FV - Register Page
 * Sistema de Gestão Integrada - Formando Valores
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { COUNTRIES } from '../constants';
import { ServiceUnit, ProcessStatus, User, UserRole, Organization } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';
import { buildOrganizationErrorMessage, loadOrganizations } from '../organizationRepository';

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
    organizationId: ''
  });

  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputClass = 'w-full p-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-blue-500';

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
      console.info('[register] iniciando cadastro', { email: formData.email });

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

        setUsers((prev) => [...prev, newUser]);
        setCurrentUser(newUser);
        setSuccess(true);
        setTimeout(() => goToRoute('/login'), 1200);
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Conta Criada!</h2>
          <p className="text-slate-400">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-full max-w-4xl bg-slate-800 p-4 sm:p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-wider text-white">SGI FV</h1>
          <p className="text-slate-400 font-semibold uppercase text-xs mt-1">Criar Nova Conta</p>
        </div>

        <div className="p-2 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold">Solicitar Registro</h2>
            <button 
              onClick={() => goToRoute('/login')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> VOLTAR AO LOGIN
            </button>
          </div>

          <div className="space-y-8">
            {/* Secção 1 */}
            <section>
              <h3 className="text-blue-400 font-bold uppercase text-xs tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-6 h-px bg-blue-400"></span> 1. Dados de Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Nome Completo</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">E-mail para Login</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="exemplo@email.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Documento Identidade</label>
                  <input required value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Identificação Fiscal (NIF/CPF)</label>
                  <input required value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Senha</label>
                  <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Confirmar Senha</label>
                  <input type="password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className={inputClass} />
                </div>
              </div>
            </section>

            {/* Secção 2 */}
            <section>
              <h3 className="text-blue-400 font-bold uppercase text-xs tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-6 h-px bg-blue-400"></span> 2. Contato & Morada
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Endereço Completo</label>
                  <input required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Estado Civil</label>
                  <select value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} className={inputClass}>
                    <option value="Solteiro">Solteiro</option>
                    <option value="Casado">Casado</option>
                    <option value="Divorciado">Divorciado</option>
                    <option value="Viúvo">Viúvo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Selecione o País (DDD)</label>
                  <select value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className={inputClass}>
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Celular / WhatsApp (apenas números)</label>
                  <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className={inputClass} placeholder="Ex: 11999999999" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block">Nº DO PROCESSO JUDICIAL (Opcional)</label>
                  <input value={formData.processNumber} onChange={e => setFormData({...formData, processNumber: e.target.value})} className={inputClass} />
                </div>
              </div>
            </section>

            {/* Secção 3 */}
            <section>
              <h3 className="text-blue-400 font-bold uppercase text-xs tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-6 h-px bg-blue-400"></span> 3. Unidade de Atendimento
              </h3>

              <div className="mb-4">
                <label className="text-xs font-bold text-slate-400 mb-2 block">Organização</label>
                <select
                  required
                  value={formData.organizationId}
                  onChange={e => setFormData({ ...formData, organizationId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Selecione a organização</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.values(ServiceUnit).map(unit => (
                  <label key={unit} className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.unit === unit ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-900 border-slate-800'}`}>
                    <input type="radio" name="unit" className="hidden" value={unit} checked={formData.unit === unit} onChange={() => setFormData({...formData, unit})} />
                    <div className="text-center">
                      <p className={`text-sm font-bold ${formData.unit === unit ? 'text-white' : 'text-slate-500'}`}>{unit}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm font-bold text-center">
                {error}
              </div>
            )}

            <div className="pt-6">
              <button 
                type="button"
                disabled={isLoading}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3"
                onClick={handleRegister}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Finalizando cadastro...</span>
                  </>
                ) : (
                  <>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    <span>Cadastrar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-slate-600 text-[10px] uppercase tracking-tighter">
        © 2026 SGI FV - Sistema de Gestão Integrada
      </p>
    </div>
  );
};

export default Register;
