import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fonts, createThemedInput, createCard, createButton, createSaveButton, createCancelButton } from '../lib/styles'
import { useTheme } from '../lib/ThemeContext'

export default function PinTableEditor() {
  const { colors, isDarkMode } = useTheme()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    part_id: '',
    created_at_from: '',
    created_at_to: '',
    updated_at_from: '',
    updated_at_to: ''
  })
  const [selectedPart, setSelectedPart] = useState(null)
  const [pinTableData, setPinTableData] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leftWidth, setLeftWidth] = useState(30)
  const [isResizing, setIsResizing] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [editingCell, setEditingCell] = useState(null)
  const containerRef = useRef()

  useEffect(() => {
    fetchParts()
  }, [filters])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
      setLeftWidth(Math.max(20, Math.min(60, newLeftWidth)))
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

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.context-menu')) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function fetchParts() {
    setLoading(true)
    try {
      let query = supabase
        .from('schematic_part')
        .select('part_id, created_at, updated_at, pin_table')
        .order('updated_at', { ascending: false })

      // Apply filters
      if (filters.part_id) {
        query = query.ilike('part_id', `%${filters.part_id}%`)
      }
      if (filters.created_at_from) {
        query = query.gte('created_at', filters.created_at_from)
      }
      if (filters.created_at_to) {
        query = query.lte('created_at', filters.created_at_to)
      }
      if (filters.updated_at_from) {
        query = query.gte('updated_at', filters.updated_at_from)
      }
      if (filters.updated_at_to) {
        query = query.lte('updated_at', filters.updated_at_to)
      }

      const { data, error } = await query.limit(500)

      if (error) throw error
      setParts(data || [])
    } catch (error) {
      console.error('Error fetching parts:', error)
    } finally {
      setLoading(false)
    }
  }

  function handlePartSelect(part) {
    // Check for unsaved changes
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to switch parts?')) {
        return
      }
    }

    setSelectedPart(part)
    setHasChanges(false)
    setParseError(null)
    setCurrentPage(0)
    setSelectedRows(new Set())
    
    // Parse pin table data with better error handling
    let parsedData = null
    try {
      if (part.pin_table) {
        if (typeof part.pin_table === 'string') {
          parsedData = JSON.parse(part.pin_table)
        } else if (typeof part.pin_table === 'object') {
          parsedData = part.pin_table
        }
        
        // Validate structure
        if (parsedData && (!parsedData.pins || !Array.isArray(parsedData.pins))) {
          // Handle different pin table formats
          if (Array.isArray(parsedData)) {
            parsedData = { pins: parsedData, footnote: '' }
          } else {
            throw new Error('Invalid pin table structure')
          }
        }
        
        // Ensure footnote exists
        if (parsedData && !parsedData.footnote) {
          parsedData.footnote = ''
        }
        
        console.log('Parsed pin table:', {
          rows: parsedData?.pins?.length || 0,
          columns: parsedData?.pins?.[0]?.length || 0,
          hasFootnote: !!parsedData?.footnote
        })
        
      } else {
        parsedData = { pins: [], footnote: '' }
      }
    } catch (error) {
      console.error('Error parsing pin table:', error)
      setParseError(error.message)
      parsedData = { pins: [], footnote: '' }
    }
    
    setPinTableData(parsedData)
  }

  function updateCell(rowIndex, colIndex, value) {
    try {
      const newTable = { ...pinTableData }
      if (!newTable.pins[rowIndex]) {
        newTable.pins[rowIndex] = []
      }
      // Ensure row has enough columns
      while (newTable.pins[rowIndex].length <= colIndex) {
        newTable.pins[rowIndex].push('')
      }
      newTable.pins[rowIndex][colIndex] = value
      setPinTableData(newTable)
      setHasChanges(true)
    } catch (error) {
      console.error('Error updating cell:', error)
    }
  }

  function addRow(position = 'bottom', targetIndex = -1) {
    try {
      const newTable = { ...pinTableData }
      const colCount = newTable.pins[0] ? newTable.pins[0].length : 3
      const newRow = new Array(colCount).fill('')
      
      if (position === 'bottom') {
        newTable.pins.push(newRow)
      } else if (position === 'above' && targetIndex > 0) {
        newTable.pins.splice(targetIndex, 0, newRow)
      } else if (position === 'below') {
        newTable.pins.splice(targetIndex + 1, 0, newRow)
      }
      
      setPinTableData(newTable)
      setHasChanges(true)
    } catch (error) {
      console.error('Error adding row:', error)
      alert('Failed to add row. Please try again.')
    }
  }

  function deleteRow(rowIndex) {
    if (rowIndex === 0) {
      alert('Cannot delete header row')
      return
    }
    
    try {
      const newTable = { ...pinTableData }
      newTable.pins.splice(rowIndex, 1)
      setPinTableData(newTable)
      setHasChanges(true)
    } catch (error) {
      console.error('Error deleting row:', error)
      alert('Failed to delete row. Please try again.')
    }
  }

  function deleteSelectedRows() {
    if (selectedRows.size === 0) return
    if (!confirm(`Delete ${selectedRows.size} selected row(s)?`)) return
    
    try {
      const newTable = { ...pinTableData }
      const sortedIndices = Array.from(selectedRows).sort((a, b) => b - a) // Delete from bottom to top
      
      for (const index of sortedIndices) {
        if (index > 0) { // Don't delete header
          newTable.pins.splice(index, 1)
        }
      }
      
      setPinTableData(newTable)
      setSelectedRows(new Set())
      setHasChanges(true)
    } catch (error) {
      console.error('Error deleting rows:', error)
      alert('Failed to delete rows. Please try again.')
    }
  }

  function addColumn(position = 'right', targetIndex = -1) {
    try {
      const newTable = { ...pinTableData }
      
      newTable.pins.forEach(row => {
        if (position === 'right') {
          row.push('')
        } else if (position === 'left' && targetIndex >= 0) {
          row.splice(targetIndex, 0, '')
        } else if (position === 'after' && targetIndex >= 0) {
          row.splice(targetIndex + 1, 0, '')
        }
      })
      
      setPinTableData(newTable)
      setHasChanges(true)
    } catch (error) {
      console.error('Error adding column:', error)
      alert('Failed to add column. Please try again.')
    }
  }

  function deleteColumn(colIndex) {
    if (pinTableData.pins[0] && pinTableData.pins[0].length <= 1) {
      alert('Cannot delete the last column')
      return
    }
    
    try {
      const newTable = { ...pinTableData }
      newTable.pins.forEach(row => {
        if (row.length > colIndex) {
          row.splice(colIndex, 1)
        }
      })
      setPinTableData(newTable)
      setHasChanges(true)
    } catch (error) {
      console.error('Error deleting column:', error)
      alert('Failed to delete column. Please try again.')
    }
  }

  function createEmptyTable() {
    const newTable = { 
      pins: [['Pin Number', 'Pin Name', 'Signal Name', 'Direction', 'Type', 'Description']], 
      footnote: ''
    }
    setPinTableData(newTable)
    setHasChanges(true)
  }

  async function deletePinTable() {
    if (!selectedPart) return
    if (!confirm('Are you sure you want to delete the entire pin table? This cannot be undone.')) {
      return
    }
    try {
      setSaving(true)
      const { error } = await supabase
        .from('schematic_part')
        .update({ 
          pin_table: null,
          updated_at: new Date().toISOString()
        })
        .eq('part_id', selectedPart.part_id)

      if (error) throw error

      // Reflect deletion locally
      setPinTableData({ pins: [], footnote: '' })
      setHasChanges(false)
      setSelectedRows(new Set())
      setParts(prevParts => 
        prevParts.map(p => 
          p.part_id === selectedPart.part_id 
            ? { ...p, pin_table: null, updated_at: new Date().toISOString() }
            : p
        )
      )
      setSelectedPart(prev => prev ? { ...prev, pin_table: null, updated_at: new Date().toISOString() } : prev)
    } catch (error) {
      console.error('Error deleting pin table:', error)
      alert('Failed to delete pin table. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function updateFootnote(footnote) {
    const newTable = { ...pinTableData, footnote }
    setPinTableData(newTable)
    setHasChanges(true)
  }

  async function savePinTable() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('schematic_part')
        .update({ 
          pin_table: pinTableData,
          updated_at: new Date().toISOString()
        })
        .eq('part_id', selectedPart.part_id)

      if (error) throw error

      // Update the part in the parts list
      setParts(prevParts => 
        prevParts.map(p => 
          p.part_id === selectedPart.part_id 
            ? { ...p, pin_table: pinTableData, updated_at: new Date().toISOString() }
            : p
        )
      )

      setHasChanges(false)
    } catch (error) {
      console.error('Error saving pin table:', error)
      alert('Failed to save pin table. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleContextMenu = (e, type, index) => {
    e.preventDefault()
    e.stopPropagation()
    
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      type,
      index
    })
  }

  const handleRowSelection = (rowIndex, selected) => {
    const newSelected = new Set(selectedRows)
    if (selected) {
      newSelected.add(rowIndex)
    } else {
      newSelected.delete(rowIndex)
    }
    setSelectedRows(newSelected)
  }

  // Memoized calculations for performance
  const tableStats = useMemo(() => {
    const data = pinTableData
    if (!data || !data.pins || !Array.isArray(data.pins)) return null
    
    const totalRows = data.pins.length
    const dataRows = Math.max(0, totalRows - 1) // Exclude header
    const maxColumns = Math.max(...data.pins.map(row => Array.isArray(row) ? row.length : 0))
    
    return {
      totalRows,
      dataRows,
      maxColumns,
      hasData: totalRows > 0
    }
  }, [pinTableData])

  // Paginated data for large tables
  const paginatedData = useMemo(() => {
    const data = pinTableData
    if (!data || !data.pins || !Array.isArray(data.pins) || data.pins.length <= 1) return data
    
    const headers = data.pins[0]
    const dataRows = data.pins.slice(1)
    const startIndex = currentPage * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRows = dataRows.slice(startIndex, endIndex)
    
    return {
      ...data,
      pins: [headers, ...paginatedRows],
      pagination: {
        currentPage,
        totalPages: Math.ceil(dataRows.length / pageSize),
        totalDataRows: dataRows.length,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, dataRows.length)
      }
    }
  }, [pinTableData, currentPage, pageSize])

  // Calculate consistent column widths
  const calculatedColumnWidths = useMemo(() => {
    if (!pinTableData || !pinTableData.pins || pinTableData.pins.length === 0) return []
    
    const maxColumns = Math.max(...pinTableData.pins.map(row => row.length))
    const widths = []
    
    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
      let maxWidth = 120 // minimum width
      
      pinTableData.pins.forEach(row => {
        if (row[colIndex]) {
          const textLength = String(row[colIndex]).length
          const estimatedWidth = Math.min(textLength * 8 + 24, 300) // max 300px
          maxWidth = Math.max(maxWidth, estimatedWidth)
        }
      })
      
      widths.push(maxWidth)
    }
    
    return widths
  }, [pinTableData])

  const renderTableCell = (cell, rowIndex, colIndex, isHeader = false, actualRowIndex = null) => {
    const cellValue = cell || ''
    const width = calculatedColumnWidths[colIndex] || 120
    const displayRowIndex = actualRowIndex !== null ? actualRowIndex : rowIndex
    const isEditing = editingCell === `${displayRowIndex}-${colIndex}`
    
    return (
      <div
        key={colIndex}
        style={{
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          padding: '8px 12px',
          border: `1px solid ${colors.borderLight}`,
          backgroundColor: isHeader 
            ? colors.light 
            : (isEditing ? `${colors.primary}08` : colors.white),
          fontSize: isHeader ? '12px' : '13px',
          fontWeight: isHeader ? '600' : '400',
          color: isHeader ? colors.primary : colors.text,
          lineHeight: '1.4',
          overflow: 'hidden',
          position: 'relative',
          cursor: isEditing ? 'text' : 'default'
        }}
        onContextMenu={(e) => handleContextMenu(e, isHeader ? 'column' : 'cell', colIndex)}
        onDoubleClick={() => setEditingCell(`${displayRowIndex}-${colIndex}`)}
      >
        {isEditing ? (
          <textarea
            value={cellValue}
            onChange={(e) => updateCell(displayRowIndex, colIndex, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingCell(null)
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                setEditingCell(null)
              }
            }}
            style={{
              width: '100%',
              minHeight: '20px',
              maxHeight: '120px',
              border: 'none',
              background: 'transparent',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              outline: 'none',
              fontFamily: fonts.system,
              padding: 0,
              resize: 'vertical',
              lineHeight: '1.4'
            }}
            placeholder={isHeader ? 'Header' : 'Value'}
            autoFocus
          />
        ) : (
          <div
            style={{
              width: '100%',
              wordWrap: 'break-word',
              whiteSpace: cellValue.length > 50 ? 'pre-wrap' : 'nowrap',
              overflow: cellValue.length > 50 ? 'visible' : 'hidden',
              textOverflow: cellValue.length > 50 ? 'clip' : 'ellipsis'
            }}
            title={cellValue.length > 30 ? cellValue : undefined}
          >
            {cellValue || (isHeader ? 'Header' : '')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      style={{
        display: 'flex',
        flex: 1,
        backgroundColor: colors.light,
        fontFamily: fonts.system,
        position: 'relative'
      }}
    >
      {/* Parts List */}
      <div style={{
        width: `${leftWidth}%`,
        padding: '20px',
        backgroundColor: colors.white,
        borderRight: `2px solid ${colors.borderLight}`,
        overflow: 'auto',
        minWidth: '300px'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          color: colors.textDark,
          fontSize: '20px',
          fontWeight: '600',
          fontFamily: fonts.mono
        }}>
          📌 pin_table_editor
        </h2>

        {/* Filters */}
        <div style={{
          ...createCard({
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: colors.white,
            border: `1px solid ${colors.border}`
          })
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            color: colors.text,
            fontSize: '14px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Filters
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Search by Part ID"
              value={filters.part_id}
              onChange={(e) => handleFilterChange('part_id', e.target.value)}
              style={{
                ...createThemedInput(colors),
                width: '100%'
              }}
            />
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: colors.textMuted,
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Created From
              </label>
              <input
                type="date"
                value={filters.created_at_from}
                onChange={(e) => handleFilterChange('created_at_from', e.target.value)}
                style={{
                  ...createThemedInput(colors),
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: colors.textMuted,
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Created To
              </label>
              <input
                type="date"
                value={filters.created_at_to}
                onChange={(e) => handleFilterChange('created_at_to', e.target.value)}
                style={{
                  ...createThemedInput(colors),
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '8px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: colors.textMuted,
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Updated From
              </label>
              <input
                type="date"
                value={filters.updated_at_from}
                onChange={(e) => handleFilterChange('updated_at_from', e.target.value)}
                style={{
                  ...createThemedInput(colors),
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: colors.textMuted,
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Updated To
              </label>
              <input
                type="date"
                value={filters.updated_at_to}
                onChange={(e) => handleFilterChange('updated_at_to', e.target.value)}
                style={{
                  ...createThemedInput(colors),
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>
          </div>
        </div>

        {/* Parts List */}
        <div style={{
          ...createCard({
            padding: '0',
            maxHeight: 'calc(100vh - 400px)',
            overflow: 'auto',
            backgroundColor: colors.white,
            border: `1px solid ${colors.border}`
          })
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.borderLight}`,
            backgroundColor: colors.light,
            fontWeight: '600',
            fontSize: '14px',
            color: colors.text,
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            Parts ({parts.length})
          </div>

          {loading ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: colors.textMuted,
              fontSize: '14px'
            }}>
              <div style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: `2px solid ${colors.borderLight}`,
                borderTop: `2px solid ${colors.primary}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '12px'
              }}></div>
              <div>Loading parts...</div>
            </div>
          ) : (
            <div>
              {parts.map(part => (
                <div
                  key={part.part_id}
                  onClick={() => handlePartSelect(part)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${colors.borderLight}`,
                    backgroundColor: selectedPart?.part_id === part.part_id ? `${colors.primary}15` : colors.white,
                    borderLeft: selectedPart?.part_id === part.part_id ? `3px solid ${colors.primary}` : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    if (selectedPart?.part_id !== part.part_id) {
                      e.currentTarget.style.backgroundColor = colors.light
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedPart?.part_id !== part.part_id) {
                      e.currentTarget.style.backgroundColor = colors.white
                    }
                  }}
                >
                  <div style={{
                    fontWeight: '600',
                    color: colors.textDark,
                    marginBottom: '6px',
                    fontSize: '14px',
                    lineHeight: '1.3'
                  }}>
                    {part.part_id}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      Updated: {new Date(part.updated_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: '2-digit'
                      })}
                    </span>
                    {part.pin_table && (
                      <span style={{
                        backgroundColor: `${colors.primary}20`,
                        color: colors.primary,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        📌 PIN TABLE
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {parts.length === 0 && (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: '14px'
                }}>
                  No parts found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        style={{ 
          width: '4px', 
          backgroundColor: colors.borderLight,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'background-color 0.2s'
        }}
        onMouseDown={() => setIsResizing(true)}
        onMouseOver={(e) => e.target.style.backgroundColor = colors.primary}
        onMouseOut={(e) => e.target.style.backgroundColor = colors.borderLight}
      >
        <div style={{
          width: '2px',
          height: '40px',
          backgroundColor: colors.white,
          borderRadius: '1px',
          boxShadow: `0 0 4px ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`
        }} />
      </div>

      {/* Pin Table Editor */}
      <div style={{
        width: `${100 - leftWidth}%`,
        padding: '20px',
        overflow: 'auto',
        backgroundColor: colors.white,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedPart ? (
          <>
            {/* Header */}
            <div style={{
              ...createCard({
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: colors.white,
                border: `1px solid ${colors.border}`
              })
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <div>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    color: colors.textDark,
                    fontSize: '20px',
                    fontWeight: '600',
                    fontFamily: fonts.mono
                  }}>
                    {selectedPart.part_id}
                  </h3>
                  <div style={{
                    fontSize: '14px',
                    color: colors.textMuted,
                    marginBottom: '4px'
                  }}>
                    Last updated: {new Date(selectedPart.updated_at).toLocaleString()}
                  </div>
                  {parseError && (
                    <div style={{
                      fontSize: '12px',
                      color: colors.danger,
                      backgroundColor: `${colors.danger}10`,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      marginTop: '4px'
                    }}>
                      ⚠️ Parse Error: {parseError}
                    </div>
                  )}
                </div>
                
                {tableStats && tableStats.hasData && (
                  <div style={{
                    backgroundColor: `${colors.success}20`,
                    color: colors.success,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>📊</span>
                    {tableStats.dataRows} rows × {tableStats.maxColumns} columns
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between'
              }}>
                {tableStats && tableStats.hasData ? (
                  <>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      <span
                        onClick={!hasChanges || saving ? undefined : savePinTable}
                        style={{
                          ...createSaveButton(),
                          backgroundColor: hasChanges && !saving ? '#d4edda' : colors.light,
                          color: hasChanges && !saving ? '#155724' : colors.textMuted,
                          border: hasChanges && !saving ? '1px solid #c3e6cb' : `1px solid ${colors.border}`,
                          opacity: hasChanges && !saving ? 1 : 0.6,
                          cursor: hasChanges && !saving ? 'pointer' : 'not-allowed'
                        }}
                        onMouseOver={(e) => {
                          if (hasChanges && !saving) {
                            e.target.style.backgroundColor = '#c3e6cb'
                            e.target.style.color = '#155724'
                          }
                        }}
                        onMouseOut={(e) => {
                          if (hasChanges && !saving) {
                            e.target.style.backgroundColor = '#d4edda'
                            e.target.style.color = '#155724'
                          }
                        }}
                      >
                        {saving ? '💾 Saving...' : '💾 Save Changes'}
                      </span>
                      
                      {selectedRows.size > 0 && (
                        <span
                          onClick={deleteSelectedRows}
                          style={{
                            ...createCancelButton(),
                            backgroundColor: colors.danger,
                            color: colors.white,
                            border: `1px solid ${colors.danger}`
                          }}
                          onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#dc3545'
                            e.target.style.color = colors.white
                          }}
                          onMouseOut={(e) => {
                            e.target.style.backgroundColor = colors.danger
                            e.target.style.color = colors.white
                          }}
                        >
                          🗑️ Delete {selectedRows.size} Row{selectedRows.size > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      {hasChanges && (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: `${colors.warning}20`,
                          color: colors.warning,
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ⚠️ Unsaved changes
                        </div>
                      )}
                      
                      <span
                        onClick={deletePinTable}
                        style={{
                          ...createCancelButton(),
                          backgroundColor: colors.danger,
                          color: colors.white,
                          border: `1px solid ${colors.danger}`
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = '#dc3545'
                          e.target.style.color = colors.white
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = colors.danger
                          e.target.style.color = colors.white
                        }}
                        title="Delete entire table"
                      >
                        🗑️ Delete Table
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={createEmptyTable}
                      style={createButton('success')}
                    >
                      ➕ Create Pin Table
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pin Table */}
            {tableStats && tableStats.hasData && !parseError ? (
              <div style={{
                ...createCard({
                  padding: '0',
                  overflow: 'hidden',
                  flex: 1,
                  backgroundColor: colors.white,
                  border: `1px solid ${colors.border}`
                })
              }}>
                {/* Pagination Controls for Large Tables */}
                {tableStats.dataRows > pageSize && (
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${colors.borderLight}`,
                    backgroundColor: colors.light,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: colors.textMuted
                    }}>
                      Showing {paginatedData.pagination.startIndex}-{paginatedData.pagination.endIndex} of {paginatedData.pagination.totalDataRows} rows
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        style={{
                          ...createButton('secondary', 'small'),
                          opacity: currentPage === 0 ? 0.5 : 1
                        }}
                      >
                        ← Previous
                      </button>
                      <span style={{ fontSize: '12px', color: colors.textMuted, margin: '0 8px' }}>
                        Page {currentPage + 1} of {paginatedData.pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(paginatedData.pagination.totalPages - 1, currentPage + 1))}
                        disabled={currentPage >= paginatedData.pagination.totalPages - 1}
                        style={{
                          ...createButton('secondary', 'small'),
                          opacity: currentPage >= paginatedData.pagination.totalPages - 1 ? 0.5 : 1
                        }}
                      >
                        Next →
                      </button>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(parseInt(e.target.value))
                          setCurrentPage(0)
                        }}
                        style={{
                          ...createThemedInput(colors),
                          padding: '4px 8px',
                          fontSize: '12px',
                          marginLeft: '12px'
                        }}
                      >
                        <option value={25}>25 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
                        <option value={200}>200 rows</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Table Container */}
                <div style={{
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 350px)',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 'fit-content'
                  }}>
                    {/* Header Row */}
                    <div style={{
                      display: 'flex',
                      borderBottom: `2px solid ${colors.borderLight}`,
                      backgroundColor: colors.light,
                      position: 'sticky',
                      top: 0,
                      zIndex: 2
                    }}>
                      <div style={{
                        width: '30px',
                        padding: '8px',
                        border: `1px solid ${colors.borderLight}`,
                        backgroundColor: colors.light,
                        fontSize: '10px',
                        fontWeight: '600',
                        color: colors.textMuted,
                        textAlign: 'center'
                      }}>
                        #
                      </div>
                      {paginatedData.pins[0] && paginatedData.pins[0].map((cell, colIndex) => 
                        renderTableCell(cell, 0, colIndex, true, 0)
                      )}
                      <div
                        style={{
                          width: '40px',
                          padding: '8px',
                          border: `1px solid ${colors.borderLight}`,
                          backgroundColor: colors.light,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={() => addColumn('right')}
                        title="Add column"
                      >
                        <span style={{ fontSize: '16px', color: colors.primary }}>➕</span>
                      </div>
                    </div>

                    {/* Data Rows */}
                    {paginatedData.pins.slice(1).map((row, rowIndex) => {
                      const actualRowIndex = rowIndex + 1 // Adjust for header
                      const isSelected = selectedRows.has(actualRowIndex)
                      
                      return (
                        <div 
                          key={rowIndex}
                          style={{
                            display: 'flex',
                            borderBottom: `1px solid ${colors.borderLight}`,
                            backgroundColor: isSelected ? `${colors.primary}10` : colors.white
                          }}
                          onContextMenu={(e) => handleContextMenu(e, 'row', actualRowIndex)}
                        >
                          <div style={{
                            width: '30px',
                            padding: '8px',
                            border: `1px solid ${colors.borderLight}`,
                            backgroundColor: colors.light,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleRowSelection(actualRowIndex, e.target.checked)}
                              style={{
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                          {Array.isArray(row) && row.map((cell, colIndex) => 
                            renderTableCell(cell, rowIndex + 1, colIndex, false, actualRowIndex)
                          )}
                        </div>
                      )
                    })}

                    {/* Add Row Button */}
                    <div
                      onClick={() => addRow('bottom')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        borderTop: `1px solid ${colors.borderLight}`,
                        backgroundColor: colors.light,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = `${colors.primary}15`}
                      onMouseOut={(e) => e.target.style.backgroundColor = colors.light}
                      title="Add row"
                    >
                      <span style={{ fontSize: '16px', color: colors.primary }}>➕</span>
                    </div>
                  </div>
                </div>

                {/* Footnote */}
                {(pinTableData && (pinTableData.footnote || pinTableData.footnote === '')) && (
                  <div style={{
                    padding: '16px',
                    borderTop: `1px solid ${colors.borderLight}`,
                    backgroundColor: `${colors.light}50`
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '8px',
                      gap: '8px'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: colors.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        📝 Footnote
                      </span>
                      {pinTableData.footnote && (
                        <span style={{
                          fontSize: '11px',
                          color: colors.textMuted,
                          backgroundColor: colors.light,
                          padding: '2px 6px',
                          borderRadius: '10px'
                        }}>
                          {pinTableData.footnote.length} chars
                        </span>
                      )}
                    </div>
                    <textarea
                      value={pinTableData.footnote || ''}
                      onChange={(e) => updateFootnote(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                        resize: 'vertical',
                        backgroundColor: colors.white,
                        color: colors.text,
                        fontFamily: fonts.system,
                        lineHeight: '1.4'
                      }}
                      placeholder="Enter footnote text (optional)..."
                    />
                  </div>
                )}
              </div>
            ) : parseError ? (
              <div style={{
                ...createCard({
                  padding: '40px',
                  textAlign: 'center',
                  border: `2px dashed ${colors.danger}`,
                  backgroundColor: `${colors.danger}05`
                })
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h3 style={{
                  margin: '0 0 12px 0',
                  color: colors.danger,
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  Pin Table Parse Error
                </h3>
                <p style={{
                  margin: '0 0 16px 0',
                  color: colors.textMuted,
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  There was an error parsing the pin table data:<br />
                  <code style={{
                    backgroundColor: colors.light,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: colors.danger
                  }}>
                    {parseError}
                  </code>
                </p>
                <button
                  onClick={createEmptyTable}
                  style={createButton('primary')}
                >
                  ➕ Create New Pin Table
                </button>
              </div>
            ) : (
              <div style={{
                ...createCard({
                  padding: '60px 40px',
                  textAlign: 'center',
                  border: `2px dashed ${colors.border}`,
                  backgroundColor: `${colors.light}50`
                })
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📌</div>
                <h3 style={{
                  margin: '0 0 8px 0',
                  color: colors.textDark,
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  No Pin Table Found
                </h3>
                <p style={{
                  margin: '0 0 20px 0',
                  color: colors.textMuted,
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  This part doesn't have a pin table yet.<br />
                  Click the button below to create one.
                </p>
                <button
                  onClick={createEmptyTable}
                  style={createButton('primary')}
                >
                  ➕ Create Pin Table
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{
            ...createCard({
              padding: '80px 40px',
              textAlign: 'center',
              backgroundColor: `${colors.light}50`,
              border: `1px solid ${colors.border}`
            })
          }}>
            <div style={{
              fontSize: '64px',
              marginBottom: '20px',
              opacity: 0.5
            }}>
              📌
            </div>
            <h3 style={{
              margin: '0 0 12px 0',
              color: colors.textDark,
              fontSize: '20px',
              fontWeight: '600'
            }}>
              Select a Part
            </h3>
            <p style={{
              margin: '0',
              color: colors.textMuted,
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Choose a part from the list on the left<br />
              to view and edit its pin table
            </p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: colors.white,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '180px',
            padding: '4px 0'
          }}
        >
          {contextMenu.type === 'column' && (
            <>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.text,
                  borderBottom: `1px solid ${colors.borderLight}`
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = colors.light}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  addColumn('left', contextMenu.index)
                  setContextMenu(null)
                }}
              >
                ➕ Insert Column Left
              </div>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.text,
                  borderBottom: `1px solid ${colors.borderLight}`
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = colors.light}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  addColumn('after', contextMenu.index)
                  setContextMenu(null)
                }}
              >
                ➕ Insert Column Right
              </div>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.danger
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = `${colors.danger}10`}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  if (confirm('Delete this column?')) {
                    deleteColumn(contextMenu.index)
                  }
                  setContextMenu(null)
                }}
              >
                🗑️ Delete Column
              </div>
            </>
          )}
          {contextMenu.type === 'row' && (
            <>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.text,
                  borderBottom: `1px solid ${colors.borderLight}`
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = colors.light}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  addRow('above', contextMenu.index)
                  setContextMenu(null)
                }}
              >
                ➕ Insert Row Above
              </div>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.text,
                  borderBottom: `1px solid ${colors.borderLight}`
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = colors.light}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  addRow('below', contextMenu.index)
                  setContextMenu(null)
                }}
              >
                ➕ Insert Row Below
              </div>
              <div
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: colors.danger
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = `${colors.danger}10`}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => {
                  if (confirm('Delete this row?')) {
                    deleteRow(contextMenu.index)
                  }
                  setContextMenu(null)
                }}
              >
                🗑️ Delete Row
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}