import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PdfViewer from '../components/PdfViewer'
import RulesList from '../components/RulesList'
import ReviewsTab from '../components/ReviewsTab'
import UploadTab from '../components/UploadTab'
import PinTableEditor from '../components/PinTableEditor'
import { fonts } from '../lib/styles'
import { useTheme } from '../lib/ThemeContext'
// Admin gating removed: rule editor is now visible to all users

export default function Home({ isAdmin = false }) {
  const { isDarkMode, toggleDarkMode, colors } = useTheme()
  const [activeTab, setActiveTab] = useState(isAdmin ? 'datasheet' : 'pintable')
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
  const [partsLoading, setPartsLoading] = useState(false)
  const [checklists, setChecklists] = useState([])
  const [checklistId, setChecklistId] = useState(null)
  const [isPublic, setIsPublic] = useState(null)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)
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

  function normalizeBoolean(value) {
    if (value === true || value === false) return value
    if (value === 1 || value === '1') return true
    if (value === 0 || value === '0') return false
    if (typeof value === 'string') {
      const v = value.toLowerCase()
      if (v === 'true' || v === 't' || v === 'yes' || v === 'y') return true
      if (v === 'false' || v === 'f' || v === 'no' || v === 'n') return false
    }
    return Boolean(value)
  }

  async function fetchParts() {
    setPartsLoading(true)
    try {
      // Fetch all parts using pagination to work around Supabase 1000 row limit
      let allParts = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('schematic_part')
          .select('part_id')
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (error) throw error
        
        if (data && data.length > 0) {
          allParts = [...allParts, ...data]
          page++
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      console.log('Fetched parts count:', allParts.length)
      setParts(allParts)
    } catch (error) {
      console.error('Error fetching parts:', error)
    } finally {
      setPartsLoading(false)
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

      const { data: checklistRows, error: checklistError } = await supabase
        .from('schematic_checklist')
        .select('uuid,is_public,name,updated_at,created_at')
        .eq('part_id', partId)
        .order('updated_at', { ascending: false, nullsFirst: false })

      if (checklistError) throw checklistError

      setPartData(partData)
      const allChecklists = Array.isArray(checklistRows) ? checklistRows : []
      setChecklists(allChecklists)

      if (allChecklists.length === 0) {
        setChecklistId(null)
        setIsPublic(null)
        setRules([])
      } else {
        const preferred = allChecklists.find(c => normalizeBoolean(c.is_public)) || allChecklists[0]
        setChecklistId(preferred.uuid)
        setIsPublic(normalizeBoolean(preferred.is_public))
        await fetchRulesForChecklist(preferred.uuid)
      }

      if (partData.file_path) {
        await fetchPresignedUrl(partData.file_path)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRulesForChecklist(id) {
    try {
      if (!id) {
        setRules([])
        return
      }
      const { data: rulesData, error: rulesError } = await supabase
        .from('schematic_rule')
        .select('*')
        .eq('checklist_id', id)

      if (rulesError) throw rulesError
      setRules(rulesData || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
    }
  }

  async function updateChecklistVisibility(nextPublic) {
    try {
      if (!checklistId) return
      setUpdatingVisibility(true)
      const { error } = await supabase
        .from('schematic_checklist')
        .update({ is_public: nextPublic ? true : false })
        .eq('uuid', checklistId)

      if (error) throw error

      setIsPublic(normalizeBoolean(nextPublic))
      setChecklists(prev => prev.map(c => c.uuid === checklistId ? { ...c, is_public: nextPublic ? true : false } : c))
    } catch (error) {
      console.error('Error updating checklist visibility:', error)
      alert('Failed to update visibility. Please try again.')
    } finally {
      setUpdatingVisibility(false)
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

  async function updateRule(rule, updates) {
    try {
      const { error } = await supabase
        .from('schematic_rule')
        .update(updates)
        .eq('uuid', rule.uuid)

      if (error) throw error

      // Update the local rules state
      setRules(prevRules => 
        prevRules.map(r => 
          r.uuid === rule.uuid 
            ? { ...r, ...updates }
            : r
        )
      )
    } catch (error) {
      console.error('Error updating rule:', error)
      throw error
    }
  }

  async function addRule(ruleData) {
    try {
      const response = await fetch('/api/add-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...ruleData, checklistId: checklistId, partId: selectedPartId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add rule')
      }

      // Add the new rule to local state
      setRules(prevRules => [...prevRules, data.rule])
    } catch (error) {
      console.error('Error adding rule:', error)
      throw error
    }
  }

  async function deleteRule(ruleId) {
    try {
      const response = await fetch('/api/delete-rule', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ruleId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete rule')
      }

      // Remove the rule from local state
      setRules(prevRules => prevRules.filter(r => r.uuid !== ruleId))
    } catch (error) {
      console.error('Error deleting rule:', error)
      throw error
    }
  }

  return (
    <>
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ 
        height: '100vh', 
        fontFamily: fonts.system,
        backgroundColor: colors.light,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          backgroundColor: colors.white,
          borderBottom: `2px solid ${colors.borderLight}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          {isAdmin && (
          <button
            onClick={() => setActiveTab('datasheet')}
            style={{
              padding: '16px 24px',
              border: 'none',
              backgroundColor: activeTab === 'datasheet' ? colors.primary : 'transparent',
              color: activeTab === 'datasheet' ? colors.white : colors.text,
              fontSize: '16px',
              fontWeight: '500',
              textTransform: 'none',
              letterSpacing: '0.25px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: fonts.mono,
              borderBottom: activeTab === 'datasheet' ? `3px solid ${colors.primaryHover}` : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            📋 rule_editor
          </button>
          )}
          {isAdmin && (
          <button
            onClick={() => setActiveTab('reviews')}
            style={{
              padding: '16px 24px',
              border: 'none',
              backgroundColor: activeTab === 'reviews' ? colors.primary : 'transparent',
              color: activeTab === 'reviews' ? colors.white : colors.text,
              fontSize: '16px',
              fontWeight: '500',
              textTransform: 'none',
              letterSpacing: '0.25px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: fonts.mono,
              borderBottom: activeTab === 'reviews' ? `3px solid ${colors.primaryHover}` : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            🔍 review_editor
          </button>
          )}
          {isAdmin && (
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '16px 24px',
              border: 'none',
              backgroundColor: activeTab === 'upload' ? colors.primary : 'transparent',
              color: activeTab === 'upload' ? colors.white : colors.text,
              fontSize: '16px',
              fontWeight: '500',
              textTransform: 'none',
              letterSpacing: '0.25px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: fonts.mono,
              borderBottom: activeTab === 'upload' ? `3px solid ${colors.primaryHover}` : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            📤 upload
          </button>
          )}
          <button
            onClick={() => setActiveTab('pintable')}
            style={{
              padding: '16px 24px',
              border: 'none',
              backgroundColor: activeTab === 'pintable' ? colors.primary : 'transparent',
              color: activeTab === 'pintable' ? colors.white : colors.text,
              fontSize: '16px',
              fontWeight: '500',
              textTransform: 'none',
              letterSpacing: '0.25px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: fonts.mono,
              borderBottom: activeTab === 'pintable' ? `3px solid ${colors.primaryHover}` : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            📌 pin_table_editor
          </button>
          
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.white,
              color: colors.text,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: fonts.mono,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = colors.light
              e.target.style.borderColor = colors.primary
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = colors.white
              e.target.style.borderColor = colors.border
            }}
          >
            {isDarkMode ? '☀️' : '🌙'} {isDarkMode ? 'light' : 'dark'}
          </button>
        </div>

        {/* Tab Content */}
        {isAdmin && activeTab === 'datasheet' ? (
          <div 
            ref={containerRef}
            style={{ 
              display: 'flex', 
              flex: 1,
              position: 'relative'
            }}
          >
      {partsLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontSize: '16px',
          color: '#fff'
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            color: '#495057',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #e9ecef',
              borderTop: '2px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '10px'
            }}></div>
            Loading parts...
          </div>
        </div>
      )}
      <div style={{ 
        width: `${leftWidth}%`, 
        padding: '20px', 
        backgroundColor: colors.white,
        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: colors.textDark,
          fontSize: '20px',
          fontWeight: '500',
          fontFamily: fonts.mono,
          letterSpacing: '0.25px'
        }}>
          datasheets{partData ? `: ${partData.part_id}` : ''}
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
            border: `2px dashed ${colors.border}`,
            borderRadius: '8px',
            backgroundColor: colors.light,
            color: colors.danger,
            fontSize: '16px'
          }}>
            ❌ Failed to load datasheet
          </div>
        ) : partData ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            border: `2px dashed ${colors.border}`,
            borderRadius: '8px',
            backgroundColor: colors.light,
            color: colors.textMuted,
            fontSize: '16px'
          }}>
            📄 Datasheet file not found!
          </div>
        ) : (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: colors.textMuted,
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
        backgroundColor: colors.white
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: colors.textDark,
            fontSize: '20px',
            fontWeight: '500',
            fontFamily: fonts.mono,
            letterSpacing: '0.25px'
          }}>
            parts
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
                border: `2px solid ${colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                marginBottom: '12px',
                backgroundColor: colors.white,
                color: colors.text,
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = colors.primary
                if (searchTerm.length >= 2) setShowDropdown(true)
              }}
              onBlur={(e) => e.target.style.borderColor = colors.borderLight}
            />
            
            {showDropdown && filteredParts.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.white,
                border: `2px solid ${colors.primary}`,
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
                      borderBottom: index < Math.min(filteredParts.length, 10) - 1 ? `1px solid ${colors.borderLight}` : 'none',
                      transition: 'background-color 0.2s',
                      color: colors.text
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.light}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.white}
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
                border: `2px solid ${colors.borderLight}`,
                borderRadius: '8px',
                backgroundColor: colors.white,
                color: colors.text,
                outline: 'none',
                boxSizing: 'border-box'
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
            color: colors.textMuted
          }}>
            Loading...
          </div>
        )}
        
        {partData && (
          <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
            {/* {partData.pin_table && (
              <PinTable pinData={partData.pin_table} />
            )} */}
            {isAdmin && checklists.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
                padding: '10px 12px',
                border: `1px solid ${colors.borderLight}`,
                borderRadius: '8px',
                backgroundColor: colors.light
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.textDark }}>
                    checklist:
                  </span>
                  <select 
                    value={checklistId || ''}
                    onChange={async (e) => {
                      const id = e.target.value
                      setChecklistId(id)
                      const selected = checklists.find(c => c.uuid === id)
                      setIsPublic(normalizeBoolean(selected?.is_public))
                      await fetchRulesForChecklist(id)
                    }}
                    style={{ 
                      padding: '6px 8px', 
                      fontSize: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      backgroundColor: colors.white,
                      color: colors.text
                    }}
                  >
                    {checklists.map(c => (
                      <option key={c.uuid} value={c.uuid}>
                        {(c.name || c.uuid).slice(0, 40)} · {normalizeBoolean(c.is_public) ? 'public' : 'private'}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '1px', height: '18px', backgroundColor: colors.borderLight }} />
                <span style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.textDark }}>
                  visibility:
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={Boolean(isPublic)}
                    onChange={(e) => updateChecklistVisibility(e.target.checked)}
                    disabled={updatingVisibility}
                    style={{ cursor: updatingVisibility ? 'not-allowed' : 'pointer' }}
                  />
                  {isPublic ? 'public' : 'private'}
                </label>
                {updatingVisibility && (
                  <span style={{ fontSize: '11px', color: colors.textMuted }}>
                    saving...
                  </span>
                )}
              </div>
            )}
            
            {rules.length > 0 && (
              <RulesList 
                rules={rules} 
                onUpdateRule={updateRule} 
                onAddRule={addRule}
                onDeleteRule={deleteRule}
                partId={selectedPartId}
              />
            )}
          </div>
        )}
        
        {/* Date filter temporarily disabled - created_at column doesn't exist */}
        {/* {!selectedPartId && (
          <div style={{ 
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: '#6c757d',
            backgroundColor: '#fff',
            padding: '6px 10px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <span>Fetching parts from last:</span>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{ 
                padding: '2px 4px', 
                fontSize: '10px',
                border: '1px solid #dee2e6',
                borderRadius: '3px',
                backgroundColor: '#fff'
              }}
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="all">All parts</option>
            </select>
          </div>
        )} */}
          </div>
        </div>
        ) : isAdmin && activeTab === 'reviews' ? (
          <ReviewsTab />
        ) : isAdmin && activeTab === 'upload' ? (
          <UploadTab />
        ) : activeTab === 'pintable' ? (
          <PinTableEditor />
        ) : (
          <PinTableEditor />
        )}
      </div>
    </>
  )
}

export async function getServerSideProps({ req }) {
  const isAdmin = true
  return { props: { isAdmin } }
}