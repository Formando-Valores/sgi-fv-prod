/**
 * SGI FV - Topbar Component
 * Action buttons and user info header
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, FileDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const { userContext, signOut } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 no-print">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            {userContext?.nome_completo || userContext?.email || 'Usuário'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            {userContext?.email}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrint}
          title="Imprimir"
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
        <button
          onClick={handlePrint}
          title="Gerar PDF"
          className="p-2 bg-blue-900/40 hover:bg-blue-900/60 rounded-lg text-blue-300 transition-colors flex items-center gap-2 px-4 text-xs font-bold border border-blue-800 uppercase"
        >
          <FileDown className="w-4 h-4" /> Gerar PDF
        </button>
        <button
          onClick={handleLogout}
          className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-lg text-red-400 transition-colors flex items-center gap-2 px-4 text-xs font-bold uppercase"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </header>
  );
};

export default Topbar;
