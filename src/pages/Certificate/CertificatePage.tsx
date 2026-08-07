import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../supabase';
import { Download, ArrowLeft } from 'lucide-react';

interface OrgCertData {
  name: string;
  certificate_nipc: string | null;
  certificate_address: string | null;
  certificate_city: string | null;
  certificate_body_text: string | null;
  certificate_signatory_name: string | null;
  certificate_signatory_title: string | null;
  certificate_seal_url: string | null;
}

const DEFAULT_ORG: OrgCertData = {
  name: 'Associação contra as Injustiças - AI',
  certificate_nipc: 'XXXXXXXX',
  certificate_address: '[Morada da Sede]',
  certificate_city: 'Lisboa – Portugal',
  certificate_body_text: null,
  certificate_signatory_name: 'Leonardo Saraiva Págio',
  certificate_signatory_title: 'Advogado',
  certificate_seal_url: null,
};

const CertificatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const processId = searchParams.get('processId');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<Record<string, string>>({});
  const [org, setOrg] = React.useState<OrgCertData>(DEFAULT_ORG);

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
        const { data: adminMemberships } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', currentUserId)
          .in('role', ['owner', 'admin'])
          .limit(1);

        const isSuperAdmin = (adminMemberships?.length ?? 0) > 0;

        if (!isSuperAdmin) {
          setError('Você não tem permissão para acessar este certificado.');
          setLoading(false);
          return;
        }
      }

      // Fetch org certificate config
      if (process.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, certificate_nipc, certificate_address, certificate_city, certificate_body_text, certificate_signatory_name, certificate_signatory_title, certificate_seal_url')
          .eq('id', process.org_id)
          .maybeSingle();
        if (orgData) {
          setOrg({
            name: orgData.name || DEFAULT_ORG.name,
            certificate_nipc: orgData.certificate_nipc,
            certificate_address: orgData.certificate_address,
            certificate_city: orgData.certificate_city,
            certificate_body_text: orgData.certificate_body_text,
            certificate_signatory_name: orgData.certificate_signatory_name,
            certificate_signatory_title: orgData.certificate_signatory_title,
            certificate_seal_url: orgData.certificate_seal_url,
          });
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
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <p className="text-surface-500 font-bold">Carregando certificado...</p>
      </div>
    );
  }

  if (error || !data.nome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <div className="text-center">
          <p className="text-red-600 font-bold text-lg mb-4">{error || 'Erro ao carregar certificado.'}</p>
          <a href="/" className="text-brand-600 underline font-bold">Voltar ao início</a>
        </div>
      </div>
    );
  }

  const nipc = org.certificate_nipc || 'XXXXXXXX';
  const address = org.certificate_address || '[Morada da Sede]';
  const city = org.certificate_city || 'Lisboa – Portugal';
  const signatoryName = org.certificate_signatory_name || 'Leonardo Saraiva Págio';
  const signatoryTitle = org.certificate_signatory_title || 'Advogado';

  const bodyText = org.certificate_body_text
    ? org.certificate_body_text.replace(/{orgName}/g, org.name)
    : `A <strong>${org.name}</strong>, pessoa coletiva n.º ${nipc}, com sede na ${address}, ${city}, certifica para os devidos efeitos que:`;

  const sealSrc = org.certificate_seal_url
    ? `/img/${org.certificate_seal_url}`
    : '/img/selo associação.png';

  const row = (label: string, value: string) => (
    <tr>
      <td style={{ fontWeight: 600, color: '#1e3a5f', padding: '3px 8px', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontWeight: 700, padding: '3px 8px' }}>{value}</td>
    </tr>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-100 p-4">
      <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl overflow-hidden" style={{ border: '2px solid #d4a843' }}>
        <div className="p-8 sm:p-10">
          <div style={{ textAlign: 'center', borderBottom: '3px double #d4a843', paddingBottom: 16, marginBottom: 24 }}>
            <h1 style={{ color: '#1e3a5f', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, margin: '0 0 4px' }}>Certificado de Filiação</h1>
            <p style={{ color: '#d4a843', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 4px' }}>{org.name.toUpperCase()}</p>
            <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>NIPC: {nipc} · Sede: {address} · {city}</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: '0 0 4px' }}>N.º DE CERTIFICADO</p>
            <p style={{ color: '#1e3a5f', fontSize: 18, fontWeight: 900, margin: 0 }}>{data.certNumber}</p>
          </div>

          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.8, margin: '0 0 20px', textAlign: 'justify' }}
            dangerouslySetInnerHTML={{ __html: bodyText }}
          />

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
            <strong> associado(a) efetivo(a)</strong> da {org.name}, com todos os direitos
            e deveres previstos nos Estatutos e no Regulamento Interno.
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: '24px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
              <img
                src="/img/assinatura_leonardo_pagio.png"
                alt="Assinatura"
                style={{
                  maxWidth: '180px',
                  maxHeight: '80px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  marginBottom: 8,
                }}
              />
              <p style={{ color: '#1e3a5f', fontSize: 12, fontWeight: 700, margin: '0 0 2px' }}>{signatoryName}</p>
              <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>{signatoryTitle}</p>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
              <img
                src={sealSrc}
                alt="Selo"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'contain',
                  marginBottom: 8,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <p style={{ color: '#1e3a5f', fontSize: 12, fontWeight: 700, margin: '0 0 2px' }}>Selo</p>
              <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>(carimbo)</p>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  width: '180px',
                  height: '80px',
                  border: '2px dashed #d1d5db',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  background: '#f9fafb',
                  color: '#9ca3af',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                Assinatura do Sócio
              </div>
              <p style={{ color: '#1e3a5f', fontSize: 12, fontWeight: 700, margin: '0 0 2px' }}>Nome do Sócio</p>
              <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>{signatoryTitle}</p>
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '16px', textAlign: 'center', borderTop: '2px solid #d4a843', borderRadius: '0 0 12px 12px', margin: '0 -10px -10px' }}>
            <p style={{ color: '#9ca3af', fontSize: 10, margin: 0 }}>Documento gerado eletronicamente pelo SGI FV – Sistema de Gestão Integrada</p>
            <p style={{ color: '#9ca3af', fontSize: 10, margin: '4px 0 0' }}>
              Emissão: {data.dataFiliacao} · Válido com apresentação do código de verificação
            </p>
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              Imprimir / Salvar PDF
            </button>
          </div>

          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-surface-500 font-bold mt-6 hover:text-surface-700 justify-center flex"
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
