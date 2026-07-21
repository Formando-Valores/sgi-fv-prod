import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../supabase';
import { Download, ArrowLeft } from 'lucide-react';

const CertificatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const processId = searchParams.get('processId');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!processId) {
      setError('ID do processo não informado.');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        setError('Faça login no sistema para acessar o certificado.');
        setLoading(false);
        return;
      }
      const currentUserId = authUser.user.id;

      const { data: process, error: err } = await supabase
        .from('processes')
        .select('cliente_nome, protocolo, created_at, services_selected, cliente_user_id, org_id')
        .eq('id', processId)
        .single();

      if (err || !process) {
        setError('Processo não encontrado.');
        setLoading(false);
        return;
      }

      if (process.cliente_user_id !== currentUserId) {
        // Check if user is admin of the process org OR a global super admin
        const { data: viewerProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUserId)
          .maybeSingle();

        const isGlobalAdmin = viewerProfile?.role === 'admin';

        if (!isGlobalAdmin) {
          if (!process.org_id) {
            setError('Processo sem organização vinculada.');
            setLoading(false);
            return;
          }
          const { data: membership } = await supabase
            .from('org_members')
            .select('role')
            .eq('user_id', currentUserId)
            .eq('org_id', process.org_id)
            .in('role', ['owner', 'admin'])
            .maybeSingle();

          if (!membership) {
            setError('Você não tem permissão para acessar este certificado.');
            setLoading(false);
            return;
          }
        }
      }

      let profile: Record<string, unknown> = {};
      if (process.cliente_user_id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', process.cliente_user_id)
          .maybeSingle();
        if (p) profile = p;
      }

      const nome = process.cliente_nome || 'Associado';
      const protocolo = process.protocolo || 'N/A';
      const dataFiliacao = new Date(process.created_at).toLocaleDateString('pt-PT');
      const year = new Date().getFullYear();
      const seq = protocolo.replace(/\D/g, '').slice(-4) || '0001';
      const initials = nome.split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 4) || 'XX';
      const docTipo = (profile as any).tipo_documento || 'CC';
      const docNum = (profile as any).documento_identidade || '-';
      const docVal = (profile as any).validade_documento || '';
      const docStr = docVal ? `${docTipo} n.º ${docNum} (válido até ${docVal})` : `${docTipo} n.º ${docNum}`;

      setData({
        nome,
        protocolo,
        dataFiliacao,
        certNumber: `AI-${year}/${seq}`,
        verifCode: `AI-${year}-${seq}-${initials}`,
        nacionalidade: (profile as any).nacionalidade || '-',
        estadoCivil: (profile as any).estado_civil || '-',
        dataNascimento: (profile as any).data_nascimento || '-',
        naturalidade: (profile as any).naturalidade || '-',
        documento: docStr,
        nif: (profile as any).nif_cpf || '-',
        niss: (profile as any).niss || '-',
        morada: (profile as any).endereco && (profile as any).codigo_postal
          ? `${(profile as any).endereco}, ${(profile as any).codigo_postal}`
          : (profile as any).endereco || '-',
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

  if (error || !data.nome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-bold text-lg mb-4">{error || 'Erro ao carregar certificado.'}</p>
          <a href="/" className="text-blue-600 underline font-bold">Voltar ao início</a>
        </div>
      </div>
    );
  }

  const row = (label: string, value: string) => (
    <tr>
      <td style={{ fontWeight: 600, color: '#1e3a5f', padding: '3px 8px', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontWeight: 700, padding: '3px 8px' }}>{value}</td>
    </tr>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl overflow-hidden" style={{ border: '2px solid #d4a843' }}>
        <div className="p-8 sm:p-10">
          <div style={{ textAlign: 'center', borderBottom: '3px double #d4a843', paddingBottom: 16, marginBottom: 24 }}>
            <h1 style={{ color: '#1e3a5f', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, margin: '0 0 4px' }}>Certificado de Filiação</h1>
            <p style={{ color: '#d4a843', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 4px' }}>ASSOCIAÇÃO CONTRA AS INJUSTIÇAS - AI</p>
            <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>NIPC: XXXXXXXX · Sede: [Morada da Sede] · Lisboa – Portugal</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: '0 0 4px' }}>N.º DE CERTIFICADO</p>
            <p style={{ color: '#1e3a5f', fontSize: 18, fontWeight: 900, margin: 0 }}>{data.certNumber}</p>
          </div>

          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.8, margin: '0 0 20px', textAlign: 'justify' }}>
            A <strong>Associação contra as Injustiças - AI</strong>, pessoa coletiva n.º XXXXXXXX, com sede na
            [Morada da Sede], Lisboa – Portugal, certifica para os devidos efeitos que:
          </p>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 20, marginBottom: 20 }}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ fontSize: 14, color: '#374151' }}>
              <tbody>
                {row('Nome Completo:', data.nome)}
                {row('Nacionalidade:', data.nacionalidade)}
                {row('Estado Civil:', data.estadoCivil)}
                {row('Data de Nascimento:', data.dataNascimento)}
                {row('Naturalidade:', data.naturalidade)}
                {row('Documento:', data.documento)}
                {row('NIF:', data.nif)}
                {row('NISS:', data.niss)}
                {row('Morada:', data.morada)}
                {row('Protocolo:', data.protocolo)}
                {row('Data de Filiação:', data.dataFiliacao)}
              </tbody>
            </table>
          </div>

          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.8, margin: '0 0 24px', textAlign: 'justify' }}>
            que o(a) identificado(a) nos termos supra se encontra devidamente registado(a) como
            <strong> associado(a) efetivo(a)</strong> da Associação contra as Injustiças - AI, com todos os direitos
            e deveres previstos nos Estatutos e no Regulamento Interno da Associação.
          </p>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 6, padding: 12, display: 'inline-block' }}>
              <p style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '0 0 4px' }}>CÓDIGO DE VERIFICAÇÃO</p>
              <p style={{ color: '#1e3a5f', fontSize: 14, fontWeight: 900, fontFamily: 'monospace', margin: 0 }}>{data.verifCode}</p>
              <p style={{ color: '#9ca3af', fontSize: 9, margin: '4px 0 0' }}>
                Verifique em: {window.location.origin}/#/certificate/{processId}
              </p>
            </div>
          </div>

          <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: 24 }}>
            <tr>
              <td style={{ width: '50%', textAlign: 'center', padding: '0 8px' }}>
                <div style={{ borderTop: '1px solid #374151', padding: '8px 0 0', marginBottom: 4 }} />
                <p style={{ color: '#1e3a5f', fontSize: 12, fontWeight: 700, margin: 0 }}>O Presidente da Direção</p>
                <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>(assinatura digital)</p>
              </td>
              <td style={{ width: '50%', textAlign: 'center', padding: '0 8px' }}>
                <div style={{ borderTop: '1px solid #374151', padding: '8px 0 0', marginBottom: 4 }} />
                <p style={{ color: '#1e3a5f', fontSize: 12, fontWeight: 700, margin: 0 }}>O Secretário</p>
                <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>(assinatura digital)</p>
              </td>
            </tr>
          </table>

          <div style={{ background: '#f9fafb', padding: '16px', textAlign: 'center', borderTop: '2px solid #d4a843', borderRadius: '0 0 12px 12px', margin: '0 -10px -10px' }}>
            <p style={{ color: '#9ca3af', fontSize: 10, margin: 0 }}>Documento gerado eletronicamente pelo SGI FV – Sistema de Gestão Integrada</p>
            <p style={{ color: '#9ca3af', fontSize: 10, margin: '4px 0 0' }}>
              Emissão: {data.dataFiliacao} · Válido com apresentação do código de verificação
            </p>
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              Imprimir / Salvar PDF
            </button>
          </div>

          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 font-bold mt-6 hover:text-gray-700 justify-center flex"
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
