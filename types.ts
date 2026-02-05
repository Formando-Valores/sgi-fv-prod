
export enum ServiceUnit {
  JURIDICO = 'JURÍDICO / ADVOCACIA',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  TECNOLOGICO = 'TECNOLÓGICO / AI'
}

export enum ProcessStatus {
  PENDENTE = 'CADASTRO',
  TRIAGEM = 'TRIAGEM',
  ANALISE = 'ANÁLISE',
  CONCLUIDO = 'CONCLUÍDO'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  MANAGER = 'MANAGER' // Custom roles for hierarchy
}

export enum Hierarchy {
  FULL = 'Alteração e Edição',
  STATUS_ONLY = 'Somente Alteração',
  NOTES_ONLY = 'Somente Anotações'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  documentId: string;
  taxId: string;
  address: string;
  maritalStatus: string;
  country: string;
  phone: string;
  processNumber?: string;
  unit: ServiceUnit;
  status: ProcessStatus;
  protocol: string;
  registrationDate: string;
  lastUpdate?: string; // New field for the latest status change
  hierarchy?: Hierarchy;
  notes?: string;
  deadline?: string;
  serviceManager?: string; // Novo campo: Gestor do Serviço
}

export interface TimelineEntry {
  date: string;
  description: string;
}

export interface Country {
  name: string;
  code: string;
  flag: string;
}
