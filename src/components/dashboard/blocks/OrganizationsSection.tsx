import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Organization } from '../../../../types';
import Card from '../../ui/Card';
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

  if (!canManageOrganizations) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-black mb-4">CADASTRAR ORGANIZAÇÃO</h3>
        <form onSubmit={handleCreateOrganization} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">Nome da organização</label>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
              placeholder="Ex.: Organização Alpha"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 font-semibold">
            <input
              type="checkbox"
              checked={organizationIsActive}
              onChange={(event) => setOrganizationIsActive(event.target.checked)}
              className="w-4 h-4"
            />
            Organização ativa
          </label>
          {orgError && <p className="text-sm text-red-400 font-bold">{orgError}</p>}
          {orgSuccess && <p className="text-sm text-emerald-400 font-bold">{orgSuccess}</p>}
          <button type="submit" className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold">
            Salvar organização
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <h3 className="text-lg font-black mb-4">ORGANIZAÇÕES CADASTRADAS</h3>
        <div className="space-y-3">
          {organizations.map((organization) => {
            const isEditing = editingOrganizationId === organization.id;

            return (
              <div key={organization.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-3 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
                {isEditing ? (
                  <>
                    <input
                      value={editingOrganizationName}
                      onChange={(event) => setEditingOrganizationName(event.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-semibold"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveEditOrganization(organization.id)}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditOrganization}
                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">{organization.name}</p>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${organization.isActive ?? true ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-amber-900/40 text-amber-300 border border-amber-700'}`}>
                        {(organization.isActive ?? true) ? 'ATIVA' : 'INATIVA'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">ID: {organization.id}</p>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleStartEditOrganization(organization)}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleOrganizationStatus(organization)}
                        className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold"
                      >
                        {(organization.isActive ?? true) ? 'Inativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteOrganization(organization)}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold"
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {organizations.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-12 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-bold text-gray-500">Nenhuma organização cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">Crie sua primeira organização no formulário ao lado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationsSection;
