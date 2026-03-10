/**
 * SGI FV - Configurações Page
 * Settings placeholder
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Settings, Users, Building2, Bell } from 'lucide-react';

const Configuracoes: React.FC = () => {
  const settingsItems = [
    { to: '/configuracoes/membros', label: 'Membros da Equipe', description: 'Gerenciar usuários e permissões', icon: Users },
    { to: '#', label: 'Dados da Organização', description: 'Em construção', icon: Building2, disabled: true },
    { to: '#', label: 'Notificações', description: 'Em construção', icon: Bell, disabled: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Settings className="text-blue-500" /> Configurações
        </h1>
        <p className="text-slate-400 text-sm font-bold mt-1">Gerencie sua organização</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsItems.map((item) => (
          <Link
            key={item.label}
            to={item.disabled ? '#' : item.to}
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all ${
              item.disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4">
              <item.icon className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{item.label}</h3>
            <p className="text-sm text-slate-400">{item.description}</p>
            {item.disabled && (
              <span className="inline-block mt-2 px-2 py-1 bg-yellow-900/30 text-yellow-500 text-[10px] font-bold rounded uppercase">
                Em breve
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Configuracoes;
