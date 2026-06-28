import { supabase } from '../../supabase';

export type DbCatalogService = {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  group: string | null;
  price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

let catalogCache: DbCatalogService[] | null = null;

export async function loadServicesCatalog(force = false): Promise<DbCatalogService[]> {
  if (catalogCache && !force) return catalogCache;

  const { data } = await supabase
    .from('services_catalog')
    .select('*')
    .order('name');

  catalogCache = data || [];
  return catalogCache;
}

export function invalidateCache() {
  catalogCache = null;
}

export function filterServicesByUnit(catalog: DbCatalogService[], unit: string): DbCatalogService[] {
  return catalog.filter(s => s.unit === unit);
}

export function filterGroupsByUnit(catalog: DbCatalogService[], unit: string): string[] {
  return [...new Set(catalog.filter(s => s.unit === unit).map(s => s.group).filter(Boolean) as string[])];
}

export function filterServicesByGroup(catalog: DbCatalogService[], unit: string, group: string): DbCatalogService[] {
  return catalog.filter(s => s.unit === unit && s.group === group);
}

export async function createService(service: {
  name: string;
  description?: string;
  unit: string;
  group?: string;
  price: number;
}) {
  const { data, error } = await supabase
    .from('services_catalog')
    .insert({
      name: service.name,
      description: service.description || null,
      unit: service.unit,
      group: service.group || null,
      price: service.price,
      active: true,
    })
    .select()
    .single();

  if (!error) invalidateCache();
  return { data, error };
}

export async function updateService(id: string, updates: Partial<{
  name: string;
  description: string;
  unit: string;
  group: string;
  price: number;
  active: boolean;
}>) {
  const { data, error } = await supabase
    .from('services_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (!error) invalidateCache();
  return { data, error };
}

export async function deleteService(id: string) {
  const { error } = await supabase
    .from('services_catalog')
    .delete()
    .eq('id', id);

  if (!error) invalidateCache();
  return { error };
}