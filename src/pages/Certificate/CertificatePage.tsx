import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { Download, CheckCircle, ArrowLeft } from 'lucide-react';

const CertificatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const processId = searchParams.get('processId');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<{
    nome: string;
    protocolo: string;
    data: string;
    servicos: string;
  } | null>(null);

  React.useEffect(() => {
    if (!processId) {
      setError('ID do processo não informado.');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      const { data: process, error: err } = await supabase
        .from('processes')
        .select('cliente_nome, protocolo, created_at, services_selected')
        .eq('id', processId)
        .single();

      if (err || !process) {
        setError('Processo não encontrado.');
        setLoading(false);
        return;
      }

      const servicos = (process.services_selected as any[]) || [];
      const nomesServicos = servicos.map((s: any) => s.name).join(', ') || 'Serviço não especificado';

      setData({
        nome: process.cliente_nome || 'Associado',
        protocolo: process.protocolo || 'N/A',
        data: new Date(process.created_at).toLocaleDateString('pt-BR'),
        servicos: nomesServicos,
      });
      setLoading(false);
    };
    void fetchData();
  }, [processId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 font-bold">Carregando certificado...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-bold text-lg mb-4">{error || 'Erro ao carregar certificado.'}</p>
          <a href="/" className="text-blue-600 underline font-bold">Voltar ao início</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden">
        {/* Certificate Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 p-8 text-center text-white">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
          <h1 className="text-2xl font-black uppercase tracking-wider">Certificado de Filiação</h1>
          <p className="text-blue-200 text-sm mt-1">Associação Formando Valores</p>
        </div>

        {/* Certificate Body */}
        <div className="p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-500 uppercase font-black tracking-wider mb-1">Certificamos que</p>
            <h2 className="text-2xl font-black text-gray-900 mb-4">{data.nome}</h2>
            <div className="w-16 h-0.5 bg-blue-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-6">
              é associado(a) da <strong>Associação Formando Valores</strong>, tendo contratado os serviços abaixo e concluído o processo de filiação.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-semibold">Protocolo:</span>
                <span className="font-bold text-gray-800">{data.protocolo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-semibold">Data de Filiação:</span>
                <span className="font-bold text-gray-800">{data.data}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-semibold">Serviços:</span>
                <span className="font-bold text-gray-800 text-right max-w-[60%]">{data.servicos}</span>
              </div>
            </div>

            <div className="flex justify-center gap-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors"
              >
                <Download className="h-4 w-4" />
                Imprimir / Salvar PDF
              </button>
            </div>
          </div>

          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 font-bold mt-6 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </a>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage;
