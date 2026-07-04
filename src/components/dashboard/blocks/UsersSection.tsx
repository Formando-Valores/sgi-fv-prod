import React, { useState } from 'react';
import { Search, SearchX, Eye, Pencil } from 'lucide-react';
import { ProcessStatus, type User } from '../../../../types';

interface UsersSectionProps {
  users: User[];
  onSelectUser: (user: User) => void;
  onEditUser: (user: User) => void;
}

const UsersSection: React.FC<UsersSectionProps> = ({ users, onSelectUser, onEditUser }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div key="tab-users" className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_16px_34px_rgba(15,23,42,0.08)] animate-slideUp">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquise Por: Nome, Protocolo ou E-mail"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-gray-800 text-sm font-semibold placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[10px] font-black uppercase">Total de Registros:</span>
          <span className="bg-blue-50 px-2 py-0.5 rounded-md text-blue-600 font-bold text-xs">{filteredUsers.length}</span>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="py-12 text-center">
          <SearchX className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">Nenhum usuário encontrado</p>
          <p className="text-xs text-gray-400 mt-1">Tente alterar o termo da busca.</p>
        </div>
      ) : (
        <>
          <div className="block md:hidden space-y-3">
            {filteredUsers.map(user => (
              <div key={user.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-gray-800 text-sm truncate flex-1">{user.name}</p>
                  <span className={`ml-2 px-3 py-1 rounded-full text-[10px] font-black text-white shrink-0 ${
                    user.status === ProcessStatus.PENDENTE ? 'bg-gray-200 text-gray-700' :
                    user.status === ProcessStatus.TRIAGEM ? 'bg-yellow-600' :
                    user.status === ProcessStatus.ANALISE ? 'bg-orange-600' : 'bg-emerald-600'
                  }`}>
                    {user.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase">Telefone</p>
                    <p className="font-bold text-gray-700 truncate">{user.phone} ({user.country})</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase">Protocolo</p>
                    <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-black">{user.protocol}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase">Última Alteração</p>
                    <p className="font-bold text-gray-600 truncate">{user.lastUpdate || user.registrationDate}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => onSelectUser(user)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => onEditUser(user)} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 rounded-md text-blue-400"><Pencil className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Nome Completo</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Telefone+DDD+País</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Protocolo SGI</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Status do Processo</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4">Última Alteração</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-2 sm:py-4 font-bold text-gray-700">{user.name}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-500 font-bold whitespace-nowrap">{user.phone} ({user.country})</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4"><span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">{user.protocol}</span></td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                        user.status === ProcessStatus.PENDENTE ? 'bg-gray-200 text-gray-700' :
                        user.status === ProcessStatus.TRIAGEM ? 'bg-yellow-600' :
                        user.status === ProcessStatus.ANALISE ? 'bg-orange-600' : 'bg-emerald-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-500 text-[10px] font-bold whitespace-nowrap">{user.lastUpdate || user.registrationDate}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-right whitespace-nowrap no-print">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => onSelectUser(user)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => onEditUser(user)} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 rounded-md text-blue-400"><Pencil className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default UsersSection;
