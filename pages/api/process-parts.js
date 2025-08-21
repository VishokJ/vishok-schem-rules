import { supabase } from '../../lib/supabase'
import { spawn } from 'child_process'
import fs from 'fs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { parts, organizationName, forceRefresh } = req.body

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Parts array is required' })
    }

    if (!organizationName) {
      return res.status(400).json({ error: 'Organization name is required' })
    }

    // Clean organization name
    const cleanOrgName = organizationName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const results = {
      successful: [],
      failed: [],
      skipped: []
    }

    // Process each part
    for (const partNumber of parts) {
      try {
        // Check if part already exists (unless force refresh)
        if (!forceRefresh) {
          const { data: existingPart } = await supabase
            .from('schematic_part')
            .select('part_id')
            .eq('part_id', partNumber.trim())
            .single()

          if (existingPart) {
            results.skipped.push({
              part: partNumber,
              reason: 'Part already exists'
            })
            continue
          }
        }

        // Process the part with Python script
        const pythonResult = await processPartWithPython(partNumber.trim(), cleanOrgName, forceRefresh)

        if (pythonResult.success) {
          results.successful.push({
            part: partNumber,
            partId: pythonResult.partId,
            s3Key: pythonResult.s3Key,
            datasheetUrl: pythonResult.datasheetUrl,
            rulesGenerated: pythonResult.rulesGenerated || 0,
            checklistId: pythonResult.checklistId
          })
        } else {
          results.failed.push({
            part: partNumber,
            error: pythonResult.error || 'Unknown error'
          })
        }

      } catch (error) {
        console.error(`Error processing part ${partNumber}:`, error)
        results.failed.push({
          part: partNumber,
          error: error.message
        })
      }
    }

    res.status(200).json({
      success: true,
      ...results,
      summary: `${results.successful.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped`
    })

  } catch (error) {
    console.error('Error processing parts:', error)
    res.status(500).json({ error: 'Failed to process parts' })
  }
}

async function processPartWithPython(partNumber, organization, forceRefresh) {
  return new Promise((resolve) => {
    try {
      // Create processing request data
      const processingData = {
        partNumber,
        organization,
        forceRefresh,
        timestamp: new Date().toISOString()
      }

      // Write processing data to temp file
      const tempFile = `/tmp/part_processing_${Date.now()}.json`
      fs.writeFileSync(tempFile, JSON.stringify(processingData))

      // Call Python script
      const pythonProcess = spawn('python3', ['process_single_part.py', tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile)
        } catch (e) {
          console.warn('Failed to clean up temp file:', e)
        }

        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            resolve(result)
          } catch (e) {
            console.error('Failed to parse Python output:', stdout)
            resolve({ success: false, error: 'Invalid response from processing script' })
          }
        } else {
          console.error(`Python process failed with code ${code}:`, stderr)
          resolve({ success: false, error: `Processing failed: ${stderr}` })
        }
      })

      pythonProcess.on('error', (error) => {
        console.error('Error spawning Python process:', error)
        resolve({ success: false, error: 'Failed to start processing script' })
      })

      // Set a timeout
      setTimeout(() => {
        pythonProcess.kill()
        resolve({ success: false, error: 'Processing timed out' })
      }, 300000) // 5 minute timeout

    } catch (error) {
      console.error('Error in processPartWithPython:', error)
      resolve({ success: false, error: error.message })
    }
  })
}