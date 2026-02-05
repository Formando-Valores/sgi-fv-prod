
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { COUNTRIES } from '../constants';
import { ServiceUnit, ProcessStatus, User, UserRole } from '../types';
import { supabase } from '../App';

interface RegisterProps {
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ setUsers, setCurrentUser }) => {
  const navigate = useNavigate();
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
    unit: ServiceUnit.JURIDICO
  });

  const [error, setError] = useState('');

  const validatePassword = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    return hasMinLength && hasUpper && hasSpecial && hasNumber;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.');
      return;
    }

    // Lógica Supabase Auth conforme solicitado
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    });

    if (authError) {
      // Mostrar mensagem vinda do Supabase
      setError(authError.message);
      return;
    }

    if (data.user) {
      // Criar registro na tabela "profiles" para manter consistência dos dados
      await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            nome: formData.name,
            email: formData.email,
            role: 'CLIENTE'
          }
        ]);

      // Atualiza o estado local para que o login funcione corretamente com os dados extras
      const prefix = formData.unit === ServiceUnit.JURIDICO ? 'JURA' : 
                     formData.unit === ServiceUnit.ADMINISTRATIVO ? 'ADM' : 'TECAI';
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
        protocol: protocol,
        registrationDate: new Date().toLocaleString('pt-BR')
      };

      setUsers(prev => [...prev, newUser]);
      
      // Se sucesso: Mostrar mensagem "Cadastro realizado com sucesso" e redirecionar para tela de Login
      alert('Cadastro realizado com sucesso');
      navigate('/login');
    }
  };

  const inputClass = "w-full p-3 bg-gray-900 border border-slate-700 rounded-lg text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Banner LGPD */}
        <div className="bg-blue-900/40 p-6 border-b border-blue-800/50 flex items-start gap-4">
          <ShieldCheck className="text-blue-400 w-12 h-12 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-blue-200 uppercase text-xs tracking-widest mb-1">Aviso de Privacidade & LGPD</h3>
            <p className="text-blue-100/70 text-xs leading-relaxed">
              As informações pessoais coletadas são asseguradas pelas normas da Lei Geral de Proteção de Dados (LGPD). 
              A responsabilidade pela veracidade dos dados cadastrais na plataforma é exclusiva do usuário. 
              Ao clicar em confirmar registro, você declara estar ciente de nossas políticas de uso e privacidade.
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-bold">Solicitar Registro</h2>
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> VOLTAR AO LOGIN
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-8">
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
              <div className="flex flex-wrap gap-4">
                {Object.values(ServiceUnit).map(unit => (
                  <label key={unit} className={`flex-1 min-w-[200px] cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.unit === unit ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-900 border-slate-800'}`}>
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
                type="submit"
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <CheckCircle2 className="w-6 h-6" /> Confirmar Registro
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
