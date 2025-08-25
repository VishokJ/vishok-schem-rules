import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fonts, createThemedInput, createCard } from '../lib/styles'
import { useTheme } from '../lib/ThemeContext'

export default function UploadTab() {
  const { colors } = useTheme()
  const [uploadType, setUploadType] = useState('files') // 'files' or 'parts'
  const [organizationName, setOrganizationName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [partsList, setPartsList] = useState('')
  const [forceRefresh, setForceRefresh] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const fileInputRef = useRef()
  const dropZoneRef = useRef()
  const logsEndRef = useRef()

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
  }

  function clearLogs() {
    setLogs([])
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf'
    )
    
    if (files.length === 0) {
      alert('Please only drop PDF files.')
      return
    }
    
    setSelectedFiles(files)
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(file => 
      file.type === 'application/pdf'
    )
    setSelectedFiles(files)
  }

  function removeFile(index) {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  function validateInputs() {
    if (!organizationName.trim()) {
      alert('Please enter an organization name.')
      return false
    }

    if (uploadType === 'files' && selectedFiles.length === 0) {
      alert('Please select at least one PDF file.')
      return false
    }

    if (uploadType === 'parts' && !partsList.trim()) {
      alert('Please enter at least one part number.')
      return false
    }

    return true
  }

  async function handleSubmit() {
    if (!validateInputs()) return

    setIsUploading(true)
    clearLogs()
    setShowLogs(true)
    setUploadStatus({ type: 'info', message: 'Starting upload...' })
    addLog('🚀 Starting upload process...', 'info')
    
    try {
      if (uploadType === 'files') {
        // Upload and process files
        setUploadStatus({ type: 'info', message: 'Uploading files...' })
        addLog(`📁 Processing ${selectedFiles.length} file(s)...`, 'info')
        
        const results = []
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          setUploadStatus({ 
            type: 'info', 
            message: `Processing ${file.name} (${i + 1}/${selectedFiles.length})...` 
          })
          addLog(`📄 Uploading ${file.name} (${formatFileSize(file.size)})...`, 'info')
          
          const formData = new FormData()
          formData.append('file', file)
          formData.append('organizationName', organizationName.trim())
          formData.append('forceRefresh', forceRefresh)
          
          addLog(`🔗 Sending to processing API...`, 'info')
          
          // Set up a timeout warning for long-running processes
          const warningTimeout = setTimeout(() => {
            addLog(`⏱️ Processing is taking longer than expected. Large or complex PDFs may take several minutes to process.`, 'warning')
          }, 30000) // 30 seconds
          
          const slowWarningTimeout = setTimeout(() => {
            addLog(`⏳ Still processing... This file may be very complex. Maximum processing time is 10 minutes.`, 'warning')
          }, 120000) // 2 minutes
          
          try {
            const response = await fetch('/api/process-datasheet', {
              method: 'POST',
              body: formData
            })
            
            // Clear the timeout warnings
            clearTimeout(warningTimeout)
            clearTimeout(slowWarningTimeout)
            
            const result = await response.json()
          
            // Debug: Log the full result to see what's being returned
            console.log('API Response:', result)
          
          // Add backend logs if available
          if (result.backendLogs && result.backendLogs.trim()) {
            addLog(`🔧 Backend processing logs:`, 'info')
            const backendLogLines = result.backendLogs.split('\n').filter(line => line.trim())
            backendLogLines.forEach(line => {
              const cleanLine = line.trim()
              if (cleanLine.includes('Error') || cleanLine.includes('Failed') || cleanLine.includes('Exception')) {
                addLog(`❗ ${cleanLine}`, 'error')
              } else if (cleanLine.includes('Debug:')) {
                addLog(`🔍 ${cleanLine.replace('Debug: ', '')}`, 'info')
              } else if (cleanLine.includes('Successfully') || cleanLine.includes('Completed')) {
                addLog(`✅ ${cleanLine}`, 'success')
              } else if (cleanLine.includes('Processing') || cleanLine.includes('Loading') || cleanLine.includes('Saving')) {
                addLog(`⚙️ ${cleanLine}`, 'info')
              } else if (cleanLine) {
                addLog(`📋 ${cleanLine}`, 'info')
              }
            })
          } else {
            addLog(`⚠️ No backend logs available - check server console for details`, 'warning')
          }
          
          if (result.success) {
            addLog(`✅ ${file.name} processed successfully! Generated ${result.rulesGenerated || 0} rules`, 'success')
          } else {
            addLog(`❌ ${file.name} failed: ${result.error}`, 'error')
          }
          
          results.push({ file: file.name, ...result })
          } catch (fetchError) {
            // Clear the timeout warnings
            clearTimeout(warningTimeout)
            clearTimeout(slowWarningTimeout)
            
            addLog(`❌ Network error processing ${file.name}: ${fetchError.message}`, 'error')
            results.push({ file: file.name, success: false, error: `Network error: ${fetchError.message}` })
          }
        }
        
        // Show results
        const successful = results.filter(r => r.success)
        const failed = results.filter(r => !r.success)
        
        addLog(`🏁 Upload completed! ${successful.length} successful, ${failed.length} failed`, 
               successful.length === results.length ? 'success' : 'warning')
        
        setUploadStatus({
          type: successful.length === results.length ? 'success' : 'warning',
          message: `Completed! ${successful.length} successful, ${failed.length} failed`,
          details: results
        })
        
      } else {
        // Process parts lookup
        const parts = partsList
          .split(',')
          .map(part => part.trim())
          .filter(part => part.length > 0)
        
        addLog(`🔍 Looking up ${parts.length} part(s): ${parts.join(', ')}`, 'info')
        setUploadStatus({ type: 'info', message: 'Looking up parts...' })
        
        const response = await fetch('/api/process-parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parts,
            organizationName: organizationName.trim(),
            forceRefresh
          })
        })

        const result = await response.json()
        
        if (result.success) {
          const { successful, failed, skipped } = result
          addLog(`🏁 Parts processing completed! ${successful.length} successful, ${failed.length} failed, ${skipped.length} skipped`, 
                 successful.length > 0 ? 'success' : 'warning')
          setUploadStatus({
            type: successful.length > 0 ? 'success' : 'warning',
            message: `Completed! ${successful.length} successful, ${failed.length} failed, ${skipped.length} skipped`,
            details: result
          })
        } else {
          addLog(`❌ Parts processing failed: ${result.error}`, 'error')
          throw new Error(result.error || 'Failed to process parts')
        }
      }

      // Reset form on success
      addLog('🧹 Resetting form...', 'info')
      setSelectedFiles([])
      setPartsList('')
      setOrganizationName('')
      setForceRefresh(false)
      
    } catch (error) {
      console.error('Error during upload:', error)
      addLog(`💥 Upload failed: ${error.message}`, 'error')
      setUploadStatus({
        type: 'error',
        message: `Upload failed: ${error.message}`
      })
    } finally {
      setIsUploading(false)
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  return (
    <div style={{
      padding: '24px',
      backgroundColor: colors.light,
      minHeight: '100vh',
      fontFamily: fonts.system
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            margin: '0 0 8px 0',
            color: colors.textDark,
            fontSize: '28px',
            fontWeight: '600',
            fontFamily: fonts.mono
          }}>
            📤 upload
          </h1>
          <p style={{
            margin: '0',
            color: colors.textMuted,
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            Upload datasheets or provide part numbers to automatically generate schematic rules
          </p>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Upload Form */}
          <div style={{
            ...createCard({ 
              padding: '32px',
              backgroundColor: colors.white,
              marginBottom: '24px'
            })
          }}>
            <h2 style={{
              margin: '0 0 24px 0',
              color: colors.textDark,
              fontSize: '20px',
              fontWeight: '600'
            }}>
              New Upload
            </h2>

            {/* Organization Name */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: colors.text,
                fontSize: '14px'
              }}>
                Organization Name *
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Enter your organization name"
                style={{
                  ...createThemedInput(colors),
                  width: '100%'
                }}
                onFocus={(e) => e.target.style.borderColor = colors.primary}
                onBlur={(e) => e.target.style.borderColor = colors.borderLight}
              />
              <small style={{ color: colors.textMuted, fontSize: '12px' }}>
                Files will be stored in a folder with this name in S3
              </small>
            </div>

            {/* Upload Type Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontWeight: '600',
                color: colors.text,
                fontSize: '14px'
              }}>
                Upload Method
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: colors.text
                }}>
                  <input
                    type="radio"
                    value="files"
                    checked={uploadType === 'files'}
                    onChange={(e) => setUploadType(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  📄 Upload PDF Files
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: colors.text
                }}>
                  <input
                    type="radio"
                    value="parts"
                    checked={uploadType === 'parts'}
                    onChange={(e) => setUploadType(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  🔍 Part Numbers (Auto-download)
                </label>
              </div>
            </div>

            {/* File Upload Section */}
            {uploadType === 'files' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '12px',
                  fontWeight: '600',
                  color: colors.text,
                  fontSize: '14px'
                }}>
                  PDF Files
                </label>
                
                {/* Drop Zone */}
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? colors.primary : colors.border}`,
                    borderRadius: '8px',
                    padding: '32px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? `${colors.primary}10` : colors.light,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px'
                  }}>
                    📁
                  </div>
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: colors.text
                  }}>
                    Drop PDF files here or click to browse
                  </p>
                  <p style={{
                    margin: '0',
                    fontSize: '14px',
                    color: colors.textMuted
                  }}>
                    Supports multiple PDF files
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.white
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${colors.border}`,
                      backgroundColor: colors.light,
                      fontWeight: '600',
                      color: colors.text,
                      fontSize: '14px'
                    }}>
                      Selected Files ({selectedFiles.length})
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: index < selectedFiles.length - 1 ? `1px solid ${colors.borderLight}` : 'none'
                          }}
                        >
                          <div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: colors.text,
                              marginBottom: '2px'
                            }}>
                              {file.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: colors.textMuted
                            }}>
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              backgroundColor: colors.danger,
                              color: colors.white,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parts List Section */}
            {uploadType === 'parts' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: colors.text,
                  fontSize: '14px'
                }}>
                  Part Numbers
                </label>
                <textarea
                  value={partsList}
                  onChange={(e) => setPartsList(e.target.value)}
                  placeholder="Enter part numbers separated by commas, e.g.:&#10;LM358N, STM32F407VGT6, TPS7A4701RGWR"
                  rows={6}
                  style={{
                    ...createThemedInput(colors),
                    width: '100%',
                    resize: 'vertical',
                    fontFamily: fonts.mono,
                    fontSize: '13px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.borderLight}
                />
                <small style={{ color: colors.textMuted, fontSize: '12px' }}>
                  We'll automatically look up these parts on Octopart and download their datasheets
                </small>
              </div>
            )}

            {/* Force Refresh Option */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                color: colors.text
              }}>
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                🔄 Force refresh - Update existing parts if they already exist in the database
              </label>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isUploading ? colors.textMuted : colors.primary,
                color: colors.white,
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                if (!isUploading) {
                  e.target.style.backgroundColor = colors.primaryHover
                }
              }}
              onMouseOut={(e) => {
                if (!isUploading) {
                  e.target.style.backgroundColor = colors.primary
                }
              }}
            >
              {isUploading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Starting Upload...
                </>
              ) : (
                <>🚀 Start Upload</>
              )}
            </button>
          </div>

        </div>
      </div>
      
      {/* Upload Status Modal Overlay */}
      {uploadStatus && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: colors.white,
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: `1px solid ${colors.borderLight}`
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>
                  {uploadStatus.type === 'error' ? '❌' :
                   uploadStatus.type === 'success' ? '✅' :
                   uploadStatus.type === 'warning' ? '⚠️' : '🔄'}
                </span>
                <span style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: uploadStatus.type === 'error' ? colors.statusFail :
                         uploadStatus.type === 'success' ? colors.statusPass :
                         uploadStatus.type === 'warning' ? colors.statusWarning :
                         colors.text
                }}>
                  {uploadStatus.message}
                </span>
              </div>
              
              {!isUploading && (
                <button
                  onClick={() => {
                    setUploadStatus(null)
                    setShowLogs(false)
                    clearLogs()
                  }}
                  style={{
                    padding: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colors.textMuted,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Logs Section */}
              {logs.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.light,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      marginBottom: '8px',
                      width: '100%'
                    }}
                  >
                    <span style={{ 
                      transform: showLogs ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▶
                    </span>
                    Backend Logs ({logs.length})
                  </button>
                  
                  {showLogs && (
                    <div style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      backgroundColor: colors.white,
                      maxHeight: '300px',
                      overflow: 'auto',
                      fontSize: '12px',
                      fontFamily: fonts.mono
                    }}>
                      {logs.map((log, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '6px 12px',
                            borderBottom: index < logs.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                            backgroundColor: log.type === 'error' ? '#fee' : 
                                           log.type === 'success' ? '#efe' : 
                                           log.type === 'warning' ? '#ffeaa7' : 'transparent'
                          }}
                        >
                          <span style={{ 
                            color: colors.textMuted, 
                            marginRight: '8px' 
                          }}>
                            {log.timestamp}
                          </span>
                          <span style={{ 
                            color: log.type === 'error' ? colors.statusFail :
                                   log.type === 'success' ? colors.statusPass :
                                   log.type === 'warning' ? colors.statusWarning :
                                   colors.text
                          }}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Results */}
              {uploadStatus.details && (
                <div style={{
                  fontSize: '14px',
                  color: colors.text,
                  flex: 1,
                  overflow: 'auto'
                }}>
                  {Array.isArray(uploadStatus.details) ? (
                    <div>
                      {uploadStatus.details.map((detail, index) => (
                        <div key={index} style={{
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: colors.light,
                          borderRadius: '6px',
                          border: `1px solid ${detail.success ? colors.statusPass : colors.statusFail}`
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: detail.success ? colors.statusPass : colors.statusFail
                          }}>
                            {detail.success ? '✓' : '✗'} {detail.file || detail.part || detail.item}
                          </span>
                          {detail.error && (
                            <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '6px' }}>
                              {detail.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre style={{
                      fontSize: '12px',
                      color: colors.textMuted,
                      backgroundColor: colors.light,
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      maxHeight: '300px'
                    }}>
                      {JSON.stringify(uploadStatus.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!isUploading && (
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '16px',
                borderTop: `1px solid ${colors.borderLight}`,
                textAlign: 'right' 
              }}>
                <button
                  onClick={() => {
                    setUploadStatus(null)
                    setShowLogs(false)
                    clearLogs()
                  }}
                  style={{
                    padding: '10px 20px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.primary,
                    color: colors.white,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}