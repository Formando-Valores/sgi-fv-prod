/**
 * SGI FV - Migration Status Checker
 * Utility to verify if required database migrations have been run
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

import { supabase } from '../../supabase';

// Debug mode flag
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[Migrations]', new Date().toISOString(), ...args);
};
const logError = (...args: any[]) => {
  console.error('[Migrations ERROR]', new Date().toISOString(), ...args);
};

export interface MigrationStatus {
  v_user_context: boolean;
  processes: boolean;
  process_events: boolean;
  organizations: boolean;
  org_members: boolean;
  allReady: boolean;
}

/**
 * Check if all required migrations have been run
 */
export async function checkMigrations(): Promise<MigrationStatus> {
  const startTime = performance.now();
  log('checkMigrations() starting...');
  
  const status: MigrationStatus = {
    v_user_context: false,
    processes: false,
    process_events: false,
    organizations: false,
    org_members: false,
    allReady: false
  };
  
  try {
    // Check v_user_context view
    log('Checking v_user_context view...');
    const viewStartTime = performance.now();
    const { error: viewError } = await supabase
      .from('v_user_context')
      .select('user_id')
      .limit(1);
    const viewElapsed = performance.now() - viewStartTime;
    status.v_user_context = !viewError;
    if (viewError) {
      log(`v_user_context check FAILED in ${viewElapsed.toFixed(2)}ms:`, viewError.message);
      log('  Error code:', viewError.code);
      log('  Error details:', JSON.stringify(viewError, null, 2));
    } else {
      log(`v_user_context check PASSED in ${viewElapsed.toFixed(2)}ms`);
    }
    
    // Check processes table
    log('Checking processes table...');
    const processesStartTime = performance.now();
    const { error: processesError } = await supabase
      .from('processes')
      .select('id')
      .limit(1);
    const processesElapsed = performance.now() - processesStartTime;
    status.processes = !processesError;
    if (processesError) {
      log(`processes check FAILED in ${processesElapsed.toFixed(2)}ms:`, processesError.message);
      log('  Error code:', processesError.code);
      log('  Error details:', JSON.stringify(processesError, null, 2));
    } else {
      log(`processes check PASSED in ${processesElapsed.toFixed(2)}ms`);
    }
    
    // Check process_events table
    log('Checking process_events table...');
    const eventsStartTime = performance.now();
    const { error: eventsError } = await supabase
      .from('process_events')
      .select('id')
      .limit(1);
    const eventsElapsed = performance.now() - eventsStartTime;
    status.process_events = !eventsError;
    if (eventsError) {
      log(`process_events check FAILED in ${eventsElapsed.toFixed(2)}ms:`, eventsError.message);
      log('  Error code:', eventsError.code);
      log('  Error details:', JSON.stringify(eventsError, null, 2));
    } else {
      log(`process_events check PASSED in ${eventsElapsed.toFixed(2)}ms`);
    }
    
    // Check organizations table
    log('Checking organizations table...');
    const orgsStartTime = performance.now();
    const { error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    const orgsElapsed = performance.now() - orgsStartTime;
    status.organizations = !orgsError;
    if (orgsError) {
      log(`organizations check FAILED in ${orgsElapsed.toFixed(2)}ms:`, orgsError.message);
      log('  Error code:', orgsError.code);
      log('  Error details:', JSON.stringify(orgsError, null, 2));
    } else {
      log(`organizations check PASSED in ${orgsElapsed.toFixed(2)}ms`);
    }
    
    // Check org_members table
    log('Checking org_members table...');
    const membersStartTime = performance.now();
    const { error: membersError } = await supabase
      .from('org_members')
      .select('id')
      .limit(1);
    const membersElapsed = performance.now() - membersStartTime;
    status.org_members = !membersError;
    if (membersError) {
      log(`org_members check FAILED in ${membersElapsed.toFixed(2)}ms:`, membersError.message);
      log('  Error code:', membersError.code);
      log('  Error details:', JSON.stringify(membersError, null, 2));
    } else {
      log(`org_members check PASSED in ${membersElapsed.toFixed(2)}ms`);
    }
    
    // All ready if critical tables exist
    status.allReady = status.v_user_context && status.processes && status.organizations;
    
    const totalElapsed = performance.now() - startTime;
    log(`checkMigrations() completed in ${totalElapsed.toFixed(2)}ms`);
    log('Final status:', JSON.stringify(status, null, 2));
    
  } catch (err) {
    const totalElapsed = performance.now() - startTime;
    logError(`Error checking migrations after ${totalElapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
  }
  
  return status;
}

/**
 * Get a human-readable migration status message
 */
export function getMigrationStatusMessage(status: MigrationStatus): string | null {
  log('getMigrationStatusMessage() called with:', JSON.stringify(status));
  
  if (status.allReady) {
    log('All migrations ready, returning null');
    return null;
  }
  
  const missing: string[] = [];
  
  if (!status.organizations) missing.push('organizations');
  if (!status.org_members) missing.push('org_members');
  if (!status.v_user_context) missing.push('v_user_context');
  if (!status.processes) missing.push('processes');
  if (!status.process_events) missing.push('process_events');
  
  if (missing.length === 0) {
    log('No missing tables, returning null');
    return null;
  }
  
  const message = `⚠️ Migrações não executadas! Tabelas/views ausentes: ${missing.join(', ')}. Execute os arquivos SQL em supabase/migrations/ no Supabase SQL Editor.`;
  log('Missing tables:', missing);
  log('Returning error message');
  
  return message;
}
