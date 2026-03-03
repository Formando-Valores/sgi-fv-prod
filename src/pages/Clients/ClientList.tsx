/**
 * SGI FV - Clients List Page
 * Placeholder for future client management
 */

import React from 'react';
import { Users } from 'lucide-react';

const ClientList: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Users className="text-blue-500" /> Clientes
        </h1>
        <p className="text-slate-400 text-sm font-bold mt-1">Gerenciamento de clientes</p>
      </div>

      {/* Placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-400 mb-2">Em Construção</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          O módulo de clientes está em desenvolvimento. Em breve você poderá gerenciar sua base de clientes aqui.
        </p>
        <span className="inline-block mt-4 px-4 py-2 bg-yellow-900/30 text-yellow-500 text-xs font-bold rounded-full uppercase">
          Em breve
        </span>
      </div>
    </div>
  );
};

export default ClientList;
