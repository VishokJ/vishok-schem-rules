import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { partId, pinTable } = req.body

    if (!partId) {
      return res.status(400).json({ error: 'Part ID is required' })
    }

    // Validate pin table structure
    if (pinTable && (!Array.isArray(pinTable.pins) || typeof pinTable.footnote !== 'string')) {
      return res.status(400).json({ error: 'Invalid pin table format' })
    }

    // Update the pin table
    const { data, error } = await supabase
      .from('schematic_part')
      .update({ 
        pin_table: pinTable,
        updated_at: new Date().toISOString()
      })
      .eq('part_id', partId)
      .select()

    if (error) {
      console.error('Error updating pin table:', error)
      return res.status(500).json({ error: 'Failed to update pin table' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Part not found' })
    }

    res.status(200).json({
      success: true,
      part: data[0]
    })

  } catch (error) {
    console.error('Error updating pin table:', error)
    res.status(500).json({ error: 'Failed to update pin table' })
  }
}