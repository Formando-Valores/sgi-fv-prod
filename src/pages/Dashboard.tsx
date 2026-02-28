/**
 * SGI FV - Dashboard Page
 * Main dashboard with real process statistics
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Clock, CheckCircle2, AlertCircle, ArrowRight, Loader2, FileEdit, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProcessStats, listProcesses, type Process } from '../lib/processes';
import { checkMigrations, getMigrationStatusMessage, type MigrationStatus } from '../lib/checkMigrations';

// Debug mode flag
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[Dashboard]', new Date().toISOString(), ...args);
};
const logError = (...args: any[]) => {
  console.error('[Dashboard ERROR]', new Date().toISOString(), ...args);
};

const Dashboard: React.FC = () => {
  log('Dashboard component rendering');
  
  const { userContext, isAdmin } = useAuth();
  const [stats, setStats] = useState({ total: 0, cadastro: 0, triagem: 0, analise: 0, concluido: 0 });
  const [recentProcesses, setRecentProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  log('Current state:', {
    hasUserContext: !!userContext,
    org_id: userContext?.org_id,
    isAdmin,
    loading,
    error: !!error,
    migrationStatus: migrationStatus?.allReady
  });

  useEffect(() => {
    log('useEffect[]: Component mounted, checking setup...');
    checkSetup();
    
    return () => {
      log('Dashboard component unmounting');
    };
  }, []);

  useEffect(() => {
    log('useEffect[userContext, migrationStatus]: Triggered');
    log('  - userContext?.org_id:', userContext?.org_id);
    log('  - migrationStatus?.allReady:', migrationStatus?.allReady);
    
    if (userContext?.org_id && migrationStatus?.allReady) {
      log('Conditions met, calling loadData()');
      loadData();
    } else {
      log('Conditions not met for loadData()');
      if (!userContext?.org_id) log('  - Missing org_id');
      if (!migrationStatus?.allReady) log('  - Migrations not ready');
    }
  }, [userContext?.org_id, migrationStatus?.allReady]);

  const checkSetup = async () => {
    const startTime = performance.now();
    log('checkSetup() starting...');
    
    try {
      const status = await checkMigrations();
      const elapsed = performance.now() - startTime;
      log(`checkMigrations() completed in ${elapsed.toFixed(2)}ms`);
      log('Migration status:', JSON.stringify(status, null, 2));
      
      setMigrationStatus(status);
      
      if (!status.allReady) {
        const message = getMigrationStatusMessage(status);
        log('Migrations not ready, error message:', message);
        setError(message);
        setLoading(false);
      } else {
        log('All migrations ready');
      }
    } catch (err) {
      const elapsed = performance.now() - startTime;
      logError(`Error checking setup after ${elapsed.toFixed(2)}ms:`, err);
      logError('Error stack:', (err as Error)?.stack);
      setLoading(false);
    }
  };

  const loadData = async () => {
    const startTime = performance.now();
    log('loadData() starting...');
    log('org_id:', userContext?.org_id);
    
    if (!userContext?.org_id) {
      log('No org_id in userContext, returning early');
      setStats({ total: 0, cadastro: 0, triagem: 0, analise: 0, concluido: 0 });
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      log('Fetching stats and processes in parallel...');
      
      const statsStartTime = performance.now();
      const processesStartTime = performance.now();
      
      const [statsData, processesData] = await Promise.all([
        getProcessStats(userContext.org_id).then(data => {
          const elapsed = performance.now() - statsStartTime;
          log(`getProcessStats() completed in ${elapsed.toFixed(2)}ms:`, data);
          return data;
        }),
        listProcesses(userContext.org_id).then(data => {
          const elapsed = performance.now() - processesStartTime;
          log(`listProcesses() completed in ${elapsed.toFixed(2)}ms, count:`, data.length);
          return data;
        })
      ]);
      
      const elapsed = performance.now() - startTime;
      log(`All data loaded in ${elapsed.toFixed(2)}ms`);
      
      setStats(statsData);
      setRecentProcesses(processesData.slice(0, 5));
      
      log('Stats set:', statsData);
      log('Recent processes set:', processesData.slice(0, 5).length, 'items');
    } catch (err) {
      const elapsed = performance.now() - startTime;
      logError(`Error loading dashboard data after ${elapsed.toFixed(2)}ms:`, err);
      logError('Error stack:', (err as Error)?.stack);
      setError('Erro ao carregar dados do dashboard. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
      log('loadData() finished, loading set to false');
    }
  };

  const statCards = [
    { label: 'Total de Processos', value: stats.total, icon: FolderKanban, color: 'bg-blue-600' },
    { label: 'Em Andamento', value: stats.cadastro + stats.triagem + stats.analise, icon: Clock, color: 'bg-yellow-600' },
    { label: 'Concluídos', value: stats.concluido, icon: CheckCircle2, color: 'bg-emerald-600' },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  log('Render decision:', { error: !!error, loading });

  // Show error UI if there's an error
  if (error) {
    log('Rendering error UI');
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm font-bold mt-1">
            Bem-vindo, {userContext?.nome_completo || 'Usuário'}
          </p>
        </div>

        {/* Error Message */}
        <div className="bg-red-900/20 border border-red-500 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-300 mb-2">Configuração Necessária</h3>
              <p className="text-red-200 mb-4 whitespace-pre-wrap">{error}</p>
              
              {migrationStatus && !migrationStatus.allReady && (
                <div className="bg-slate-900/50 p-4 rounded-lg mb-4">
                  <p className="text-slate-300 text-sm font-bold mb-2">Status das Migrações:</p>
                  <ul className="text-sm space-y-1">
                    <li className={migrationStatus.organizations ? 'text-emerald-400' : 'text-red-400'}>
                      {migrationStatus.organizations ? '✓' : '✗'} organizations
                    </li>
                    <li className={migrationStatus.org_members ? 'text-emerald-400' : 'text-red-400'}>
                      {migrationStatus.org_members ? '✓' : '✗'} org_members
                    </li>
                    <li className={migrationStatus.v_user_context ? 'text-emerald-400' : 'text-red-400'}>
                      {migrationStatus.v_user_context ? '✓' : '✗'} v_user_context
                    </li>
                    <li className={migrationStatus.processes ? 'text-emerald-400' : 'text-red-400'}>
                      {migrationStatus.processes ? '✓' : '✗'} processes
                    </li>
                    <li className={migrationStatus.process_events ? 'text-emerald-400' : 'text-red-400'}>
                      {migrationStatus.process_events ? '✓' : '✗'} process_events
                    </li>
                  </ul>
                </div>
              )}
              
              <div className="text-slate-400 text-sm mb-4">
                <p className="font-bold mb-1">Para executar as migrações:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse o Supabase SQL Editor</li>
                  <li>Execute os arquivos em <code className="bg-slate-800 px-1 rounded">supabase/migrations/</code> na ordem:</li>
                  <li className="ml-4">001_multiempresa.sql</li>
                  <li className="ml-4">002_rls_policies.sql</li>
                  <li className="ml-4">003_v_user_context.sql</li>
                  <li className="ml-4">004_processes.sql</li>
                  <li className="ml-4">005_rls_processes.sql</li>
                </ol>
              </div>
              
              <button
                onClick={() => {
                  log('User clicked "Verificar Novamente"');
                  window.location.reload();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Verificar Novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  log('Rendering main dashboard UI');
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Dashboard</h1>
        <p className="text-slate-400 text-sm font-bold mt-1">
          Bem-vindo, {userContext?.nome_completo || 'Usuário'} | {userContext?.org_name || 'Organização'}
        </p>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <p className="text-4xl font-black text-white mt-2">{stat.value}</p>
                </div>
                <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-500" />
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/processos"
            className="flex items-center justify-between p-4 bg-blue-900/20 border border-blue-800 rounded-xl hover:bg-blue-900/30 transition-colors group"
          >
            <div>
              <p className="font-bold text-white">Ver Processos</p>
              <p className="text-slate-400 text-sm">Visualizar todos os processos</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
          </Link>
          {isAdmin && (
            <Link
              to="/processos/novo"
              className="flex items-center justify-between p-4 bg-emerald-900/20 border border-emerald-800 rounded-xl hover:bg-emerald-900/30 transition-colors group"
            >
              <div>
                <p className="font-bold text-white">Novo Processo</p>
                <p className="text-slate-400 text-sm">Criar um novo processo</p>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Recent Processes */}
      {!loading && recentProcesses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-purple-500" />
            Processos Recentes
          </h2>
          <div className="space-y-3">
            {recentProcesses.map((process) => (
              <Link
                key={process.id}
                to={`/processos/${process.id}`}
                className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-[10px] font-black">
                    {process.protocolo || '-'}
                  </span>
                  <div>
                    <p className="font-bold text-white text-sm">{process.titulo}</p>
                    <p className="text-slate-500 text-xs">{process.cliente_nome || 'Sem cliente'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs">{formatDate(process.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
