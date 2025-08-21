import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

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

    // Generate S3 key
    const fileName = file.originalFilename || file.newFilename
    const s3Key = `${cleanOrgName}/${fileName}`

    // Check if organization folder exists by trying to list objects
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${cleanOrgName}/`,
      }))
    } catch (error) {
      // Organization folder doesn't exist, we'll create it when we upload the first file
      console.log(`Creating new organization folder: ${cleanOrgName}`)
    }

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
        'upload-timestamp': new Date().toISOString()
      }
    })

    await s3Client.send(uploadCommand)

    // Clean up temporary file
    fs.unlinkSync(file.filepath)

    res.status(200).json({
      success: true,
      s3Key,
      fileName,
      organization: cleanOrgName,
      size: file.size
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
}