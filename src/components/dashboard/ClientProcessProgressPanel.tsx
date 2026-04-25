import React from 'react';
import Badge from '../ui/Badge';

export interface ClientProcessProgressHistoryItem {
  id: string;
  dateLabel: string;
  message: string;
}

export interface ClientProcessProgressPanelProps {
  serviceName: string;
  responsibleSector: string;
  currentStatus: string;
  currentStepIndex: number;
  history: ClientProcessProgressHistoryItem[];
}

const PROCESS_STEPS = ['Atendimento iniciado', 'Coleta', 'Análise', 'Execução', 'Conclusão'];

const ClientProcessProgressPanel: React.FC<ClientProcessProgressPanelProps> = ({
  serviceName,
  responsibleSector,
  currentStatus,
  currentStepIndex,
  history,
}) => {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-gray-800">Jornada do cliente</h3>
        <Badge variant="info" className="text-xs px-2.5 py-1">
          {currentStatus}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Serviço contratado</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">{serviceName}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Setor responsável</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">{responsibleSector}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Status atual</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">{currentStatus}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">Etapas</p>
        <div className="space-y-2">
          {PROCESS_STEPS.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const dotClass = isDone ? 'bg-emerald-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-300';

            return (
              <div key={step} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                <p className={`text-sm ${isDone || isCurrent ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                  {step}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">Histórico resumido</p>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 font-semibold">Sem atualizações recentes para este processo.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs font-black text-gray-500">{item.dateLabel}</p>
                <p className="text-sm text-gray-700 font-semibold">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
};

export default ClientProcessProgressPanel;
