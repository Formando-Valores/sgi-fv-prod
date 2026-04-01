
import React from 'react';
import { LogOut, Printer, FileDown, User as UserIcon, Calendar, Clock, Landmark, Activity, UserCheck, MessageSquare } from 'lucide-react';
import { User, ProcessStatus } from '../types';

interface UserDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, onLogout }) => {
  const steps = [
    { label: ProcessStatus.PENDENTE, color: 'bg-slate-500' },
    { label: ProcessStatus.TRIAGEM, color: 'bg-yellow-400' },
    { label: ProcessStatus.ANALISE, color: 'bg-orange-500' },
    { label: ProcessStatus.CONCLUIDO, color: 'bg-[#39ff14]' },
  ];

  const currentStepIndex = steps.findIndex(s => s.label === currentUser.status);

  const handlePrint = () => {
    window.print();
  };

  return (
  <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tighter">SGI FV FORMANDO VALORES</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-gray-500 text-xs font-bold uppercase">{currentUser.registrationDate}</p>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <p className="text-gray-700 text-sm font-bold">{currentUser.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint} 
            title="Imprimir visualização atual"
            className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-gray-200"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={handlePrint} 
            title="Salvar como PDF"
            className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors flex items-center gap-2 px-4 text-xs font-bold border border-blue-200 uppercase"
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </button>
          <button onClick={onLogout} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase border border-red-200">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Section */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <Activity className="text-blue-500" /> STATUS DO PROCESSO
              </h2>
              <span className="bg-blue-50 px-3 py-1 rounded-full text-[10px] font-black text-blue-600 tracking-widest uppercase">ACOMPANHAMENTO EM TEMPO REAL</span>
            </div>

            {/* Stepper */}
            <div className="relative flex justify-between mb-12">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
              {steps.map((step, idx) => (
                <div key={step.label} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white transition-all ${idx <= currentStepIndex ? step.color : 'bg-gray-300'}`}>
                    {idx < currentStepIndex ? <div className="w-3 h-3 bg-white rounded-full"></div> : null}
                    {idx === currentStepIndex ? <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div> : null}
                  </div>
                  <span className={`mt-3 text-[10px] font-black uppercase tracking-tighter ${idx <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Destaque Central Dividido: Gestor e Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
               {/* Lado Esquerdo: Gestor */}
               <div className="p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gray-200">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-blue-600 shadow-xl`}>
                    <UserCheck className="text-white w-8 h-8" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-gray-800">{currentUser.serviceManager || 'A DEFINIR'}</p>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Gestor Responsável</p>
               </div>

               {/* Lado Direito: Notas do Atendimento */}
               <div className="p-8 flex flex-col items-center text-center">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-purple-600 shadow-xl`}>
                    <MessageSquare className="text-white w-8 h-8" />
                  </div>
                  <div className="max-h-24 overflow-y-auto w-full">
                    <p className="text-sm font-bold text-gray-700 leading-tight italic">
                      {currentUser.notes ? `"${currentUser.notes}"` : "Nenhuma observação no momento."}
                    </p>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-widest">Notas do Atendimento</p>
               </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Landmark className="text-emerald-500" /> PROCESSAMENTO ADMINISTRATIVO
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Protocolo SGI</p>
                <p className="text-xl font-black text-blue-400">{currentUser.protocol}</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Situação Atual</p>
                <p className="text-xl font-black text-gray-800">{currentUser.status}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sidebar Data Section */}
        <section className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <UserIcon className="text-purple-500" /> DADOS CADASTRAIS
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Unidade</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.unit}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Identificação Fiscal</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.taxId}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">Contato</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.phone}</p>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase">País / DDD</p>
                <p className="text-sm font-bold text-gray-700">{currentUser.country}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Calendar className="text-orange-500" /> LINHA DO TEMPO
            </h2>
            <div className="max-h-64 overflow-y-auto pr-2 relative">
              <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-8 pl-6 relative">
                {currentUser.lastUpdate && (
                   <div className="relative">
                    <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                    <p className="text-xs font-black text-emerald-500">{currentUser.lastUpdate}</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">ATUALIZAÇÃO DE STATUS</p>
                    <p className="text-xs text-gray-500">O processo avançou para a etapa de {currentUser.status}.</p>
                  </div>
                )}
                <div className="relative">
                  <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                  <p className="text-xs font-black text-blue-400">{currentUser.registrationDate}</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">REGISTRO SGI FV</p>
                  <p className="text-xs text-gray-500">Ficha de cliente aberta com sucesso.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
);

export default UserDashboard;
