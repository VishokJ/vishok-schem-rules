import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { ruleId } = req.body

    if (!ruleId) {
      return res.status(400).json({ error: 'Rule ID is required' })
    }

    // Delete the rule
    const { error: deleteError } = await supabase
      .from('schematic_rule')
      .delete()
      .eq('uuid', ruleId)

    if (deleteError) {
      console.error('Error deleting rule:', deleteError)
      return res.status(500).json({ error: 'Failed to delete rule' })
    }

    res.status(200).json({
      success: true,
      message: 'Rule deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting rule:', error)
    res.status(500).json({ error: 'Failed to delete rule' })
  }
}