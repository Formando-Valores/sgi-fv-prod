import React, { useMemo, useState } from 'react';
import { Building2, Search, Pencil, Power, Trash2, MoreVertical, Check, X } from 'lucide-react';
import { Organization } from '../../../../types';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Badge from '../../ui/Badge';
import { createOrganization, updateOrganization, deleteOrganization, updateOrganizationStatus, buildOrganizationErrorMessage } from '../../../../organizationRepository';

interface OrganizationsSectionProps {
  organizations: Organization[];
  onRefreshOrganizations: () => Promise<void>;
  canManageOrganizations: boolean;
}

const OrganizationsSection: React.FC<OrganizationsSectionProps> = ({
  organizations,
  onRefreshOrganizations,
  canManageOrganizations,
}) => {
  const [organizationName, setOrganizationName] = useState('');
  const [organizationIsActive, setOrganizationIsActive] = useState(true);
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [editingOrganizationName, setEditingOrganizationName] = useState('');
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrgError('');
    setOrgSuccess('');

    if (!organizationName.trim()) {
      setOrgError('Informe o nome da organização.');
      return;
    }

    const { organization, error } = await createOrganization(organizationName, organizationIsActive);

    if (error || !organization) {
      console.error('[organizacoes] erro ao cadastrar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrganizationName('');
    setOrganizationIsActive(true);
    setOrgSuccess(`Organização ${organization.name} cadastrada com sucesso.`);
    await onRefreshOrganizations();
  };

  const handleStartEditOrganization = (organization: Organization) => {
    setEditingOrganizationId(organization.id);
    setEditingOrganizationName(organization.name);
    setOrgError('');
    setOrgSuccess('');
  };

  const handleCancelEditOrganization = () => {
    setEditingOrganizationId(null);
    setEditingOrganizationName('');
  };

  const handleSaveEditOrganization = async (organizationId: string) => {
    setOrgError('');
    setOrgSuccess('');

    const { error } = await updateOrganization(organizationId, editingOrganizationName);

    if (error) {
      console.error('[organizacoes] erro ao editar organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess('Organização atualizada com sucesso.');
    handleCancelEditOrganization();
    await onRefreshOrganizations();
  };

  const handleToggleOrganizationStatus = async (organization: Organization) => {
    setOrgError('');
    setOrgSuccess('');

    const nextStatus = !(organization.isActive ?? true);
    const { error } = await updateOrganizationStatus(organization.id, nextStatus);

    if (error) {
      console.error('[organizacoes] erro ao atualizar status da organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess(`Organização ${organization.name} marcada como ${nextStatus ? 'ativa' : 'inativa'}.`);
    await onRefreshOrganizations();
  };

  const handleDeleteOrganization = async (organization: Organization) => {
    if (!window.confirm(`Deseja realmente excluir a organização ${organization.name}?`)) {
      return;
    }

    setOrgError('');
    setOrgSuccess('');

    const { error } = await deleteOrganization(organization.id);

    if (error) {
      console.error('[organizacoes] erro ao excluir organização', error);
      setOrgError(buildOrganizationErrorMessage(error));
      return;
    }

    setOrgSuccess(`Organização ${organization.name} excluída com sucesso.`);
    await onRefreshOrganizations();
  };

  const filteredOrganizations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter((organization) => organization.name.toLowerCase().includes(query));
  }, [organizations, searchQuery]);

  if (!canManageOrganizations) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-start gap-6 animate-fade-in">
      {/* Cadastro */}
      <Card padding="md" className="lg:sticky lg:top-24">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-surface-900 leading-tight">Cadastrar Organização</h2>
            <p className="text-xs text-surface-500 mt-0.5">Adicione uma nova organização ao sistema.</p>
          </div>
        </div>

        <form onSubmit={handleCreateOrganization} className="space-y-4">
          <Input
            label="Nome da organização"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Ex.: Organização Alpha"
            className="h-12"
          />

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-200 bg-surface-50/50 cursor-pointer transition-colors duration-150 hover:border-surface-300 select-none">
            <input
              type="checkbox"
              checked={organizationIsActive}
              onChange={(event) => setOrganizationIsActive(event.target.checked)}
              className="w-4 h-4 rounded accent-brand-600 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-sm font-medium text-surface-700">Organização ativa</span>
          </label>

          {orgError && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              {orgError}
            </p>
          )}
          {orgSuccess && (
            <p className="text-sm text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
              {orgSuccess}
            </p>
          )}

          <Button type="submit" className="w-full h-11">
            <Building2 className="w-4 h-4" />
            Salvar Organização
          </Button>
        </form>
      </Card>

      {/* Lista */}
      <div className="space-y-6 min-w-0">
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-base font-bold text-surface-900 leading-tight">Organizações Cadastradas</h2>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-surface-500 shrink-0">
              <Building2 className="w-4 h-4 text-surface-400" />
              {organizations.length} {organizations.length === 1 ? 'organização' : 'organizações'}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pesquisar organização..."
              className="w-full h-12 pl-10 pr-10 bg-white border border-surface-200 rounded-xl text-sm text-surface-800 font-medium placeholder:text-surface-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar pesquisa"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {filteredOrganizations.map((organization) => {
            const isEditing = editingOrganizationId === organization.id;
            const active = organization.isActive ?? true;

            return (
              <div
                key={organization.id}
                className="bg-white border border-surface-200/70 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 animate-fade-in"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-surface-500 mb-2">Editar organização</h3>
                      <Input
                        value={editingOrganizationName}
                        onChange={(event) => setEditingOrganizationName(event.target.value)}
                        placeholder="Nome da organização"
                        autoFocus
                        className="h-12"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="success" size="sm" onClick={() => void handleSaveEditOrganization(organization.id)}>
                        <Check className="w-3.5 h-3.5" />
                        Salvar
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleCancelEditOrganization}>
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-surface-100 border border-surface-200/70 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-surface-500" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-surface-900 truncate">{organization.name}</h3>
                          <p className="text-xs text-surface-500 font-medium mt-0.5 truncate">ID: {organization.id}</p>
                        </div>
                      </div>
                      <Badge variant={active ? 'success' : 'neutral'} dot className="shrink-0">
                        {active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>

                    {/* Ações - mobile */}
                    <div className="mt-6 flex items-center gap-2 lg:hidden">
                      <Button
                        variant="outline"
                        size="md"
                        className="flex-1 h-11"
                        onClick={() => handleStartEditOrganization(organization)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </Button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenActionsId(openActionsId === organization.id ? null : organization.id)}
                          aria-label="Mais ações"
                          aria-expanded={openActionsId === organization.id}
                          className="h-11 w-12 inline-flex items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-500 hover:bg-surface-50 hover:text-surface-700 transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openActionsId === organization.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenActionsId(null)} />
                            <div className="absolute right-0 top-full mt-2 w-44 z-30 bg-white border border-surface-200 rounded-xl shadow-card py-1.5 animate-scale-in">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsId(null);
                                  void handleToggleOrganizationStatus(organization);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors duration-150 text-left"
                              >
                                <Power className="w-3.5 h-3.5 text-amber-500" />
                                {active ? 'Inativar' : 'Ativar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsId(null);
                                  void handleDeleteOrganization(organization);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150 text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Ações - desktop */}
                    <div className="mt-6 hidden lg:flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="md"
                        className="h-11"
                        onClick={() => handleStartEditOrganization(organization)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outlineWarning"
                        size="md"
                        className="h-11"
                        onClick={() => void handleToggleOrganizationStatus(organization)}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {active ? 'Inativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="outlineDanger"
                        size="md"
                        className="h-11"
                        onClick={() => void handleDeleteOrganization(organization)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {filteredOrganizations.length === 0 && (
            <div className="bg-white border border-dashed border-surface-200 rounded-2xl p-12 flex flex-col items-center text-center animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-surface-50 border border-surface-100 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 text-surface-400" />
              </div>
              <p className="text-sm font-semibold text-surface-700">
                {searchQuery ? 'Nenhuma organização encontrada' : 'Nenhuma organização cadastrada'}
              </p>
              <p className="text-xs text-surface-500 mt-1 max-w-xs">
                {searchQuery
                  ? 'Tente ajustar sua pesquisa para encontrar a organização desejada.'
                  : 'Crie sua primeira organização no formulário ao lado.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationsSection;
