
import { Country, ServiceUnit, ProcessStatus, User, UserRole } from './types';

export const COUNTRIES: Country[] = [
  { name: 'Brasil', code: '+55', flag: '🇧🇷' },
  { name: 'Estados Unidos', code: '+1', flag: '🇺🇸' },
  { name: 'Portugal', code: '+351', flag: '🇵🇹' },
  { name: 'Angola', code: '+244', flag: '🇦🇴' },
  { name: 'Moçambique', code: '+258', flag: '🇲🇿' },
  { name: 'Cabo Verde', code: '+238', flag: '🇨🇻' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'Colômbia', code: '+57', flag: '🇨🇴' },
  { name: 'Uruguai', code: '+598', flag: '🇺🇾' },
  { name: 'Paraguai', code: '+595', flag: '🇵🇾' },
  { name: 'Canadá', code: '+1', flag: '🇨🇦' },
  { name: 'México', code: '+52', flag: '🇲🇽' },
  { name: 'Espanha', code: '+34', flag: '🇪🇸' },
  { name: 'Itália', code: '+39', flag: '🇮🇹' },
];

export const SERVICE_MANAGERS = [
  'Adriano Duarte',
  'Carlos Alexandre Cirilo',
  'Germano Reis',
  'Leonardo Saraiva Págio'
];

export const ADMIN_CREDENTIALS = [
  'contato@vainaai.com',
  'contato@formandovalores.com'
];

export const ADMIN_PASSWORD = 'Sgifvadm@2026!';

export const INITIAL_MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'João Silva Teste',
    email: 'joao@exemplo.com',
    role: UserRole.CLIENT,
    documentId: '12.345.678-9',
    taxId: '123.456.789-00',
    address: 'Rua dos Pinheiros, 123, São Paulo - SP',
    maritalStatus: 'Solteiro',
    country: 'Brasil',
    phone: '11999999999',
    unit: ServiceUnit.JURIDICO,
    status: ProcessStatus.TRIAGEM,
    protocol: 'JURA-2026-001',
    registrationDate: '29/01/2026, 16:53',
    lastUpdate: '29/01/2026, 17:00',
    notes: 'Aguardando documentação complementar.',
    serviceManager: 'Adriano Duarte'
  },
  {
    id: '2',
    name: 'Maria Oliveira Admin',
    email: 'contato@vainaai.com',
    role: UserRole.ADMIN,
    documentId: '98.765.432-1',
    taxId: '000.000.000-00',
    address: 'Escritório Central SGI',
    maritalStatus: 'Casado',
    country: 'Brasil',
    phone: '11888888888',
    unit: ServiceUnit.ADMINISTRATIVO,
    status: ProcessStatus.CONCLUIDO,
    protocol: 'ADM-2026-001',
    registrationDate: '28/01/2026, 10:00',
    lastUpdate: '28/01/2026, 10:00'
  }
];
