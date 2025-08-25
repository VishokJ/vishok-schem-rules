import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { supabase } from '../../lib/supabase'
import formidable from 'formidable'
import fs from 'fs'
import { spawn } from 'child_process'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse the uploaded file
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true,
    })

    const [fields, files] = await form.parse(req)
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file
    const organizationName = Array.isArray(fields.organizationName) 
      ? fields.organizationName[0] 
      : fields.organizationName
    const forceRefresh = Array.isArray(fields.forceRefresh)
      ? fields.forceRefresh[0] === 'true'
      : fields.forceRefresh === 'true'

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    if (!organizationName) {
      return res.status(400).json({ error: 'Organization name is required' })
    }

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' })
    }

    // Clean organization name for use as S3 folder
    const cleanOrgName = organizationName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Generate part ID from filename
    const partId = file.originalFilename?.replace('.pdf', '') || file.newFilename.replace('.pdf', '')
    
    // Check if part already exists (unless force refresh)
    if (!forceRefresh) {
      const { data: existingPart } = await supabase
        .from('schematic_part')
        .select('part_id')
        .eq('part_id', partId)
        .single()

      if (existingPart) {
        return res.status(200).json({
          success: false,
          error: 'Part already exists. Use force refresh to update.',
          partId
        })
      }
    }

    // Generate S3 key
    const fileName = file.originalFilename || file.newFilename
    const s3Key = `${cleanOrgName}/${fileName}`

    // Read file content
    const fileContent = fs.readFileSync(file.filepath)

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf',
      Metadata: {
        'organization': cleanOrgName,
        'original-filename': fileName,
        'upload-timestamp': new Date().toISOString(),
        'part-id': partId
      }
    })

    await s3Client.send(uploadCommand)

    // Clean up temporary file
    fs.unlinkSync(file.filepath)

    // Process the datasheet with Python script
    const pythonResult = await processDatasheetWithPython(s3Key, partId, cleanOrgName)

    if (pythonResult.success) {
      res.status(200).json({
        success: true,
        partId,
        s3Key,
        fileName,
        organization: cleanOrgName,
        rulesGenerated: pythonResult.rulesGenerated || 0,
        checklistId: pythonResult.checklistId
      })
    } else {
      res.status(200).json({
        success: false,
        error: pythonResult.error || 'Failed to process datasheet',
        partId,
        s3Key
      })
    }

  } catch (error) {
    console.error('Error processing datasheet:', error)
    res.status(500).json({ error: 'Failed to process datasheet' })
  }
}

async function processDatasheetWithPython(s3Key, partId, organization) {
  return new Promise((resolve) => {
    try {
      // Create a temporary processing request
      const processingData = {
        s3Key,
        partId,
        organization,
        timestamp: new Date().toISOString()
      }

      // Write processing data to temp file
      const tempFile = `/tmp/processing_${Date.now()}.json`
      fs.writeFileSync(tempFile, JSON.stringify(processingData))

      // Call Python script using conda environment with proper activation
      const pythonProcess = spawn('bash', ['-c', `source ~/.zshrc && conda activate schematic-admin && python -u process_single_datasheet.py ${tempFile}`], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      })

      let stdout = ''
      let stderr = ''
      let allLogs = []

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log(`Python stdout: ${output}`)
      })

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        allLogs.push(output)
        console.log(`Python stderr: ${output}`)
      })

      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile)
        } catch (e) {
          console.warn('Failed to clean up temp file:', e)
        }

        console.log(`Python process exited with code: ${code}`)
        console.log(`Python complete stderr: ${stderr}`)

        if (code === 0 || code === null) {
          try {
            // Try to parse JSON from stdout
            const jsonLines = stdout.split('\n').filter(line => {
              const trimmed = line.trim()
              return trimmed.startsWith('{') && trimmed.endsWith('}')
            })
            
            if (jsonLines.length > 0) {
              // Take the last valid JSON line (final result)
              const result = JSON.parse(jsonLines[jsonLines.length - 1])
              // Add comprehensive backend logs to the result
              result.backendLogs = allLogs.join('')
              resolve(result)
            } else {
              // No valid JSON found
              resolve({ 
                success: false, 
                error: `No valid JSON output found. Raw output: ${stdout}`, 
                backendLogs: allLogs.join('') 
              })
            }
          } catch (e) {
            console.error('Failed to parse Python output:', stdout)
            resolve({ 
              success: false, 
              error: `Invalid JSON response: ${e.message}. Raw output: ${stdout}`, 
              backendLogs: allLogs.join('') 
            })
          }
        } else {
          console.error(`Python process failed with code ${code}:`, stderr)
          resolve({ 
            success: false, 
            error: `Processing failed (exit code ${code}). Check backend logs for details.`, 
            backendLogs: allLogs.join('') 
          })
        }
      })

      pythonProcess.on('error', (error) => {
        console.error('Error spawning Python process:', error)
        resolve({ 
          success: false, 
          error: `Failed to start processing script: ${error.message}`, 
          backendLogs: allLogs.join('') 
        })
      })

    } catch (error) {
      console.error('Error in processDatasheetWithPython:', error)
      resolve({ success: false, error: error.message, backendLogs: '' })
    }
  })
}