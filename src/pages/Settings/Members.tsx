/**
 * SGI FV - Members Settings Page
 * Organization members management
 */

import React from 'react';
import { Settings, Users, UserPlus, Shield } from 'lucide-react';

const Members: React.FC = () => {
  // Placeholder data
  const members = [
    { id: '1', name: 'Admin Master', email: 'admin@sgi.com', role: 'Administrador' },
    { id: '2', name: 'João Gestor', email: 'joao@sgi.com', role: 'Gestor' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Settings className="text-slate-400" /> Configurações
          </h1>
          <p className="text-slate-400 text-sm font-bold mt-1">Membros da Organização</p>
        </div>
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg">
          <UserPlus className="w-5 h-5" /> Convidar Membro
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="text-blue-500" /> Membros Ativos
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                <th className="px-6 py-4">Membro</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Função</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-200">{member.name}</td>
                  <td className="px-6 py-4 text-slate-400 font-bold">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-blue-900/30 text-blue-400 border border-blue-900/50">
                      <Shield className="w-3 h-3" /> {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-white text-xs font-bold uppercase">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Members;
