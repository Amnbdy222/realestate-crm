import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function repair() {
  console.log('Starting database repair...');

  // 1. Repair Organizations and Profiles
  const { data: profiles, error: profsErr } = await supabase.from('profiles').select('*');
  if (profsErr) {
    console.error('Error fetching profiles:', profsErr);
    return;
  }
  const { data: orgs, error: orgsErr } = await supabase.from('organizations').select('*');
  if (orgsErr) {
    console.error('Error fetching orgs:', orgsErr);
    return;
  }

  console.log(`Found ${profiles.length} profiles and ${orgs.length} organizations.`);

  // Find or create Default Org for amndby222@gmail.com
  let defaultOrg = orgs.find(o => o.name === 'DealBook Default');
  if (!defaultOrg) {
    console.log('Creating DealBook Default organization...');
    const { data: newOrg, error: createErr } = await supabase
      .from('organizations')
      .insert({ name: 'DealBook Default' })
      .select()
      .single();
    if (createErr) {
      console.error('Error creating default org:', createErr);
      return;
    }
    defaultOrg = newOrg;
    console.log('Created DealBook Default org:', defaultOrg.id);
  }

  // Find or create Macrotech Org for pranjalmacrotech22@gmail.com
  let macrotechOrg = orgs.find(o => o.name === 'macrotech');
  if (!macrotechOrg) {
    console.log('Creating macrotech organization...');
    const { data: newOrg, error: createErr } = await supabase
      .from('organizations')
      .insert({ name: 'macrotech' })
      .select()
      .single();
    if (createErr) {
      console.error('Error creating macrotech org:', createErr);
      return;
    }
    macrotechOrg = newOrg;
    console.log('Created macrotech org:', macrotechOrg.id);
  }

  // KK Org for dubeypranjal0960@gmail.com
  const kkOrg = orgs.find(o => o.name === 'kk');
  if (!kkOrg) {
    console.error('KK Org not found in organizations! Run migration first or create it.');
    return;
  }

  // Update profiles table mapping
  console.log('Updating profiles to assign correct org_id...');
  for (const profile of profiles) {
    let targetOrgId = null;
    let targetOrgName = profile.org_name;

    if (profile.email === 'amndby222@gmail.com') {
      targetOrgId = defaultOrg.id;
      targetOrgName = 'DealBook Default';
    } else if (profile.email === 'amndby223@gmail.com' || profile.email === 'rahul@123.com') {
      targetOrgId = defaultOrg.id;
      targetOrgName = 'DealBook Default';
    } else if (profile.email === 'pranjalmacrotech22@gmail.com') {
      targetOrgId = macrotechOrg.id;
      targetOrgName = 'macrotech';
    } else if (profile.email === 'dubeypranjal0960@gmail.com') {
      targetOrgId = kkOrg.id;
      targetOrgName = 'kk';
    } else if (profile.admin_id) {
      // Find admin's org
      const admin = profiles.find(p => p.id === profile.admin_id);
      if (admin) {
        if (admin.email === 'amndby222@gmail.com') {
          targetOrgId = defaultOrg.id;
          targetOrgName = 'DealBook Default';
        } else if (admin.email === 'pranjalmacrotech22@gmail.com') {
          targetOrgId = macrotechOrg.id;
          targetOrgName = 'macrotech';
        } else if (admin.email === 'dubeypranjal0960@gmail.com') {
          targetOrgId = kkOrg.id;
          targetOrgName = 'kk';
        }
      }
    }

    if (targetOrgId) {
      console.log(`Setting profile ${profile.email} to org ${targetOrgName} (${targetOrgId})`);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ org_id: targetOrgId, org_name: targetOrgName })
        .eq('id', profile.id);
      if (updateErr) console.error(`Error updating profile ${profile.email}:`, updateErr);
    }
  }

  // Update owner_id for organizations to ensure link exists
  console.log('Updating organization owner links...');
  const mainAdmin = profiles.find(p => p.email === 'amndby222@gmail.com');
  if (mainAdmin) {
    await supabase.from('organizations').update({ owner_id: mainAdmin.id }).eq('id', defaultOrg.id);
  }
  const macrotechAdmin = profiles.find(p => p.email === 'pranjalmacrotech22@gmail.com');
  if (macrotechAdmin) {
    await supabase.from('organizations').update({ owner_id: macrotechAdmin.id }).eq('id', macrotechOrg.id);
  }
  const kkAdmin = profiles.find(p => p.email === 'dubeypranjal0960@gmail.com');
  if (kkAdmin) {
    await supabase.from('organizations').update({ owner_id: kkAdmin.id }).eq('id', kkOrg.id);
  }

  // Re-fetch repaired profiles map to assign to data rows
  const { data: repairedProfiles } = await supabase.from('profiles').select('id, org_id');
  const profileOrgMap = {};
  repairedProfiles.forEach(p => {
    profileOrgMap[p.id] = p.org_id;
  });

  // Helper to update table rows
  async function repairTable(tableName, userField = 'user_id', parentTable = null, parentField = null) {
    console.log(`Repairing table ${tableName}...`);
    const { data: rows, error: readErr } = await supabase.from(tableName).select('*');
    if (readErr) {
      console.log(`Table ${tableName} read error (might not exist):`, readErr.message);
      return;
    }

    let updatedCount = 0;
    for (const row of rows) {
      if (row.org_id === null) {
        let resolvedOrgId = null;

        // Try mapping by user_id
        if (row[userField] && profileOrgMap[row[userField]]) {
          resolvedOrgId = profileOrgMap[row[userField]];
        }
        
        // Fallback mapping by assigned_to
        if (!resolvedOrgId && row.assigned_to && profileOrgMap[row.assigned_to]) {
          resolvedOrgId = profileOrgMap[row.assigned_to];
        }

        // Fallback mapping by created_by (for tasks)
        if (!resolvedOrgId && row.created_by && profileOrgMap[row.created_by]) {
          resolvedOrgId = profileOrgMap[row.created_by];
        }

        // Parent fallback (e.g. towers belongs to projects, units belongs to towers)
        if (!resolvedOrgId && parentTable && parentField && row[parentField]) {
          const { data: parentRow } = await supabase
            .from(parentTable)
            .select('org_id')
            .eq('id', row[parentField])
            .single();
          if (parentRow && parentRow.org_id) {
            resolvedOrgId = parentRow.org_id;
          }
        }

        // Ultimate fallback: Assign to Default Org if we cannot resolve it
        if (!resolvedOrgId) {
          resolvedOrgId = defaultOrg.id;
        }

        if (resolvedOrgId) {
          const { error: updateErr } = await supabase
            .from(tableName)
            .update({ org_id: resolvedOrgId })
            .eq('id', row.id);
          if (updateErr) {
            console.error(`Error updating row ${row.id} in ${tableName}:`, updateErr);
          } else {
            updatedCount++;
          }
        }
      }
    }
    console.log(`Finished table ${tableName}. Updated ${updatedCount} rows.`);
  }

  // Run repairs on tables in dependency order
  // 1. Base tables with user_id
  await repairTable('projects', 'user_id');
  await repairTable('channel_partners', 'user_id');
  await repairTable('leads', 'user_id');
  await repairTable('properties', 'user_id');

  // 2. Child tables of base tables
  await repairTable('towers', 'user_id', 'projects', 'project_id');
  await repairTable('units', 'user_id', 'towers', 'tower_id');
  
  // 3. Lead dependents and project dependents
  await repairTable('deals', 'user_id');
  await repairTable('bookings', 'user_id');
  await repairTable('follow_ups', 'user_id');
  await repairTable('activities', 'user_id');
  
  // 4. Safe tables (may not exist)
  await repairTable('documents', 'user_id');
  await repairTable('tasks', 'user_id');
  await repairTable('communications', 'user_id');
  await repairTable('notifications', 'user_id');

  console.log('Database repair completed successfully!');
}

repair();
