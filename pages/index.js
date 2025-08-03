import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PdfViewer from '../components/PdfViewer'
import RulesList from '../components/RulesList'

export default function Home() {
  const [partData, setPartData] = useState(null)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState('')
  const [parts, setParts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [leftWidth, setLeftWidth] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const containerRef = useRef()
  const searchRef = useRef()

  useEffect(() => {
    fetchParts()
  }, [])

  useEffect(() => {
    if (selectedPartId) {
      fetchPartData(selectedPartId)
    }
  }, [selectedPartId])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
      setLeftWidth(Math.max(20, Math.min(80, newLeftWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchParts() {
    try {
      const { data, error } = await supabase
        .from('schematic_part')
        .select('part_id')
      
      if (error) throw error
      setParts(data || [])
    } catch (error) {
      console.error('Error fetching parts:', error)
    }
  }

  async function fetchPartData(partId) {
    setLoading(true)
    setPdfUrl(null)
    try {
      const { data: partData, error: partError } = await supabase
        .from('schematic_part')
        .select('*')
        .eq('part_id', partId)
        .single()

      if (partError) throw partError

      const { data: checklistData, error: checklistError } = await supabase
        .from('schematic_checklist')
        .select('uuid')
        .eq('part_id', partId)
        .single()

      if (checklistError) throw checklistError

      const { data: rulesData, error: rulesError } = await supabase
        .from('schematic_rule')
        .select('*')
        .eq('checklist_id', checklistData.uuid)

      if (rulesError) throw rulesError

      setPartData(partData)
      setRules(rulesData || [])

      if (partData.file_path) {
        await fetchPresignedUrl(partData.file_path)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPresignedUrl(filePath) {
    setPdfLoading(true)
    try {
      const response = await fetch(`/api/presigned-url?filePath=${encodeURIComponent(filePath)}`)
      const data = await response.json()
      
      if (response.ok) {
        setPdfUrl(data.url)
      } else {
        console.error('Error getting presigned URL:', data.error)
      }
    } catch (error) {
      console.error('Error fetching presigned URL:', error)
    } finally {
      setPdfLoading(false)
    }
  }

  const filteredParts = parts.filter(part => 
    part.part_id.toLowerCase().startsWith(searchTerm.toLowerCase())
  )

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    setShowDropdown(value.length >= 2)
  }

  const handlePartSelect = (partId) => {
    setSelectedPartId(partId)
    setSearchTerm('')
    setShowDropdown(false)
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        height: '100vh', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8f9fa'
      }}
    >
      <div style={{ 
        width: `${leftWidth}%`, 
        padding: '20px', 
        backgroundColor: '#fff',
        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#2c3e50',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Datasheet Viewer{partData ? `: Part ${partData.part_id}` : ''}
        </h2>
        
        {pdfLoading ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#6c757d',
            fontSize: '16px'
          }}>
            🔄 Loading datasheet...
          </div>
        ) : pdfUrl ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PdfViewer url={pdfUrl} />
          </div>
        ) : partData?.file_path ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            border: '2px dashed #ddd',
            borderRadius: '8px',
            backgroundColor: '#f8f9fa',
            color: '#dc3545',
            fontSize: '16px'
          }}>
            ❌ Failed to load datasheet
          </div>
        ) : partData ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            border: '2px dashed #ddd',
            borderRadius: '8px',
            backgroundColor: '#f8f9fa',
            color: '#6c757d',
            fontSize: '16px'
          }}>
            📄 Datasheet file not found!
          </div>
        ) : (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#6c757d',
            fontSize: '16px'
          }}>
            Select a part to view datasheet
          </div>
        )}
      </div>
      
      <div 
        style={{ 
          width: '4px', 
          backgroundColor: '#e9ecef',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseDown={() => setIsResizing(true)}
      >
        <div style={{
          width: '2px',
          height: '40px',
          backgroundColor: '#6c757d',
          borderRadius: '1px'
        }} />
      </div>
      
      <div style={{ 
        width: `${100 - leftWidth}%`, 
        padding: '20px', 
        overflow: 'auto',
        backgroundColor: '#fff'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#2c3e50',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            Part Information
          </h2>
          
          <div ref={searchRef} style={{ marginBottom: '16px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search parts..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                marginBottom: '12px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#007bff'
                if (searchTerm.length >= 2) setShowDropdown(true)
              }}
              onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
            />
            
            {showDropdown && filteredParts.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '2px solid #007bff',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {filteredParts.slice(0, 10).map((part, index) => (
                  <div
                    key={part.part_id}
                    onClick={() => handlePartSelect(part.part_id)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: index < Math.min(filteredParts.length, 10) - 1 ? '1px solid #e9ecef' : 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    {part.part_id}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#495057',
              fontSize: '14px'
            }}>
              Select Part:
            </label>
            <select 
              value={selectedPartId} 
              onChange={(e) => setSelectedPartId(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                fontSize: '14px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                backgroundColor: '#fff',
                outline: 'none'
              }}
            >
              <option value="">Choose a part...</option>
              {parts.map(part => (
                <option key={part.part_id} value={part.part_id}>
                  {part.part_id}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {loading && selectedPartId && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: '#6c757d'
          }}>
            Loading...
          </div>
        )}
        
        {partData && (
          <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
            {/* {partData.pin_table && (
              <PinTable pinData={partData.pin_table} />
            )} */}
            
            {rules.length > 0 && (
              <RulesList rules={rules} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}