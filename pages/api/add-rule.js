import { supabase } from '../../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { partId, content, category, level, checklistId } = req.body

    if (!partId || !content) {
      return res.status(400).json({ error: 'Part ID and content are required' })
    }

    // Resolve checklist
    let resolvedChecklistId = checklistId
    if (!resolvedChecklistId) {
      const { data: rows, error: checklistError } = await supabase
        .from('schematic_checklist')
        .select('uuid,is_public,updated_at')
        .eq('part_id', partId)
        .order('updated_at', { ascending: false })

      if (checklistError || !rows || rows.length === 0) {
        return res.status(404).json({ error: 'Checklist not found for this part' })
      }
      const preferred = rows.find(r => r.is_public) || rows[0]
      resolvedChecklistId = preferred.uuid
    }

    // Create new rule
    const ruleUuid = uuidv4()
    const ruleData = {
      uuid: ruleUuid,
      content: content.trim(),
      category: category || 'Uncategorized',
      level: level || 'RECOMMENDED',
      checklist_id: resolvedChecklistId,
      is_deleted: false,
      pins: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newRule, error: insertError } = await supabase
      .from('schematic_rule')
      .insert(ruleData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting rule:', insertError)
      return res.status(500).json({ error: 'Failed to create rule' })
    }

    res.status(201).json({
      success: true,
      rule: newRule
    })

  } catch (error) {
    console.error('Error adding rule:', error)
    res.status(500).json({ error: 'Failed to add rule' })
  }
}