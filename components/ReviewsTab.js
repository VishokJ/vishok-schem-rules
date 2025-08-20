import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fonts, createEditButton, createSaveButton, createCancelButton, createThemedInput, createCard } from '../lib/styles'
import { useTheme } from '../lib/ThemeContext'

export default function ReviewsTab() {
  const { colors } = useTheme()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [foregroundLoading, setForegroundLoading] = useState(false)
  const [filters, setFilters] = useState({
    project_id: '',
    title: '',
    timespan: '7' // Default to last 1 week
  })
  const [selectedReview, setSelectedReview] = useState(null)
  const [resultFilters, setResultFilters] = useState({
    rule_content: '',
    components: '',
    status: ''
  })
  const [editingResult, setEditingResult] = useState(null)
  const [rules, setRules] = useState({})
  const [leftWidth, setLeftWidth] = useState(25)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef()
  const skipNextFetch = useRef(false)

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    fetchReviews()
  }, [filters])

  // Show loading when component first mounts
  useEffect(() => {
    fetchReviews(true)
  }, [])

  useEffect(() => {
    if (selectedReview?.results) {
      fetchRulesForResults(selectedReview.results)
    }
  }, [selectedReview])

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

  async function fetchReviews(showForegroundLoader = false) {
    // Use foreground loading for explicit user timespan changes
    if (showForegroundLoader) {
      setForegroundLoading(true)
    }
    setLoading(true)
    
    try {
      let query = supabase
        .from('schematic_review')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id)
      }
      if (filters.title) {
        query = query.ilike('title', `%${filters.title}%`)
      }
      
      // Handle timespan filter
      if (filters.timespan !== 'all') {
        const daysAgo = parseInt(filters.timespan)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setReviews(data || [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
      setForegroundLoading(false)
    }
  }

  async function fetchRulesForResults(results) {
    const ruleIds = [...new Set(results.map(result => result.rule_id).filter(Boolean))]
    
    if (ruleIds.length === 0) return

    try {
      const { data, error } = await supabase
        .from('schematic_rule')
        .select('uuid, content')
        .in('uuid', ruleIds)

      if (error) throw error
      
      const rulesMap = {}
      data.forEach(rule => {
        rulesMap[rule.uuid] = rule
      })
      setRules(rulesMap)
    } catch (error) {
      console.error('Error fetching rules:', error)
    }
  }

  async function updateReviewResult(reviewUuid, resultIndex, updates) {
    try {
      const review = reviews.find(r => r.uuid === reviewUuid)
      if (!review) return

      const updatedResults = [...review.results]
      updatedResults[resultIndex] = { ...updatedResults[resultIndex], ...updates }

      const { error } = await supabase
        .from('schematic_review')
        .update({ results: updatedResults })
        .eq('uuid', reviewUuid)

      if (error) throw error

      // Update local state
      setReviews(prev => prev.map(r => 
        r.uuid === reviewUuid 
          ? { ...r, results: updatedResults }
          : r
      ))

      if (selectedReview?.uuid === reviewUuid) {
        setSelectedReview({ ...selectedReview, results: updatedResults })
      }

      setEditingResult(null)
    } catch (error) {
      console.error('Error updating review result:', error)
      alert('Failed to update result. Please try again.')
    }
  }

  function getFilteredResults(review) {
    if (!review?.results) return []
    
    let results = Array.isArray(review.results) ? review.results : []
    
    if (resultFilters.status) {
      results = results.filter(result => 
        result.status === resultFilters.status
      )
    }
    
    if (resultFilters.components) {
      results = results.filter(result => 
        result.components?.some(comp => 
          comp.toLowerCase().includes(resultFilters.components.toLowerCase())
        )
      )
    }

    if (resultFilters.rule_content) {
      results = results.filter(result => {
        const rule = rules[result.rule_id]
        return rule?.content?.toLowerCase().includes(resultFilters.rule_content.toLowerCase())
      })
    }
    
    return results
  }

  const handleFilterChange = (key, value) => {
    // Show foreground loading when changing timespan
    if (key === 'timespan') {
      skipNextFetch.current = true
      setFilters(prev => ({ ...prev, [key]: value }))
      setTimeout(() => fetchReviews(true), 0)
    } else {
      setFilters(prev => ({ ...prev, [key]: value }))
    }
  }

  const handleResultFilterChange = (key, value) => {
    setResultFilters(prev => ({ ...prev, [key]: value }))
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
      {/* Foreground Loading Overlay */}
      {foregroundLoading && (
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
            Loading reviews...
          </div>
        </div>
      )}
      {/* Reviews List */}
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
          fontFamily: fonts.system
        }}>
          Reviews
        </h2>

        {/* Filters */}
        <div style={{ marginBottom: '20px' }}>
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
          
          <div style={{ marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="Project ID"
              value={filters.project_id}
              onChange={(e) => handleFilterChange('project_id', e.target.value)}
              style={{
                ...createThemedInput(colors),
                width: '100%'
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = colors.borderLight}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="Title"
              value={filters.title}
              onChange={(e) => handleFilterChange('title', e.target.value)}
              style={{
                ...createThemedInput(colors),
                width: '100%'
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = colors.borderLight}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <select
              value={filters.timespan}
              onChange={(e) => handleFilterChange('timespan', e.target.value)}
              style={{
                ...createThemedInput(colors),
                width: '100%'
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = colors.borderLight}
            >
              <option value="1">Last 1 day</option>
              <option value="7">Last 1 week</option>
              <option value="30">Last 1 month</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: colors.textMuted,
            fontSize: '14px'
          }}>
            Loading reviews...
          </div>
        ) : (
          <div>
            {reviews.map(review => (
              <div
                key={review.uuid}
                onClick={() => setSelectedReview(review)}
                style={{
                  ...createCard({
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: selectedReview?.uuid === review.uuid ? `${colors.primary}10` : colors.white,
                    borderColor: selectedReview?.uuid === review.uuid ? colors.primary : colors.border,
                    borderWidth: selectedReview?.uuid === review.uuid ? '2px' : '1px',
                    cursor: 'pointer'
                  })
                }}
                onMouseOver={(e) => {
                  if (selectedReview?.uuid !== review.uuid) {
                    e.currentTarget.style.backgroundColor = colors.light
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedReview?.uuid !== review.uuid) {
                    e.currentTarget.style.backgroundColor = colors.white
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                <div style={{
                  fontWeight: '600',
                  color: colors.textDark,
                  marginBottom: '6px',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }} title={review.title}>
                  {review.title}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: colors.textMuted,
                  marginBottom: '4px',
                  fontFamily: fonts.mono
                }}>
                  {review.project_id}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: colors.textMuted,
                  marginBottom: '6px'
                }}>
                  {new Date(review.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit'
                  })}
                </div>
                {review.results && (
                  <div style={{
                    fontSize: '11px',
                    color: colors.text,
                    backgroundColor: colors.light,
                    padding: '3px 6px',
                    borderRadius: '10px',
                    display: 'inline-block'
                  }}>
                    {Array.isArray(review.results) ? review.results.length : 0} results
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
          position: 'relative'
        }}
        onMouseDown={() => setIsResizing(true)}
      >
        <div style={{
          width: '2px',
          height: '40px',
          backgroundColor: colors.textMuted,
          borderRadius: '1px'
        }} />
      </div>

      {/* Review Details */}
      <div style={{
        width: `${100 - leftWidth}%`,
        padding: '20px',
        overflow: 'auto',
        backgroundColor: colors.white
      }}>
        {selectedReview ? (
          <div>
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: colors.white,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                color: colors.textDark,
                fontSize: '20px',
                fontWeight: '600'
              }}>
                {selectedReview.title}
              </h3>
              <div style={{
                fontSize: '14px',
                color: colors.textMuted,
                marginBottom: '8px'
              }}>
                Project ID: {selectedReview.project_id}
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textMuted,
                marginBottom: '8px'
              }}>
                Created: {new Date(selectedReview.created_at).toLocaleString()}
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textMuted
              }}>
                Updated: {new Date(selectedReview.updated_at).toLocaleString()}
              </div>
            </div>

            {/* Result Filters */}
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: colors.white,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                color: colors.text,
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Filter Results
              </h4>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <select
                  value={resultFilters.status}
                  onChange={(e) => handleResultFilterChange('status', e.target.value)}
                  style={{
                    ...createThemedInput(colors),
                    flex: 1,
                    minWidth: 0
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.borderLight}
                >
                  <option value="">All Statuses</option>
                  <option value="pass">Pass</option>
                  <option value="warning">Warning</option>
                  <option value="fail">Fail</option>
                </select>
                
                <input
                  type="text"
                  placeholder="Components"
                  value={resultFilters.components}
                  onChange={(e) => handleResultFilterChange('components', e.target.value)}
                  style={{
                    ...createThemedInput(colors),
                    flex: 1,
                    minWidth: 0
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.borderLight}
                />
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Rule content"
                  value={resultFilters.rule_content}
                  onChange={(e) => handleResultFilterChange('rule_content', e.target.value)}
                  style={{
                    ...createThemedInput(colors),
                    width: '100%'
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.borderLight}
                />
              </div>
            </div>

            {/* Results List */}
            <div style={{
              backgroundColor: colors.white,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{
                padding: '16px',
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: colors.light
              }}>
                <h4 style={{
                  margin: '0',
                  color: colors.text,
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Review Results ({getFilteredResults(selectedReview).length})
                </h4>
              </div>
              
              <div style={{ padding: '16px' }}>
                {getFilteredResults(selectedReview).map((result) => {
                  const resultIndex = selectedReview.results.findIndex(r => r === result)
                  const isEditing = editingResult === `${selectedReview.uuid}-${resultIndex}`
                  const rule = rules[result.rule_id]
                  
                  return (
                    <div
                      key={resultIndex}
                      style={{
                        padding: '16px',
                        marginBottom: '16px',
                        border: `2px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.white
                      }}
                    >
                      {/* Status and Actions Bar */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isEditing ? (
                            <select
                              value={result.status}
                              onChange={(e) => {
                                const updatedResult = { ...result, status: e.target.value }
                                const updatedResults = [...selectedReview.results]
                                updatedResults[resultIndex] = updatedResult
                                setSelectedReview({ ...selectedReview, results: updatedResults })
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                border: '1px solid #dee2e6'
                              }}
                            >
                              <option value="pass">PASS</option>
                              <option value="warning">WARNING</option>
                              <option value="fail">FAIL</option>
                            </select>
                          ) : (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: result.status === 'pass' ? colors.statusPassBg : 
                                             result.status === 'warning' ? colors.statusWarningBg : colors.statusFailBg,
                              color: result.status === 'pass' ? colors.statusPass : 
                                     result.status === 'warning' ? colors.statusWarning : colors.statusFail
                            }}>
                              {result.status?.toUpperCase()}
                            </span>
                          )}
                          
                          {result.components && (
                            <span style={{
                              fontSize: '12px',
                              color: '#6c757d',
                              backgroundColor: '#f8f9fa',
                              padding: '4px 8px',
                              borderRadius: '4px'
                            }}>
                              Components: {result.components.join(', ')}
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {isEditing ? (
                            <>
                              <span
                                onClick={() => updateReviewResult(selectedReview.uuid, resultIndex, result)}
                                style={{
                                  ...createSaveButton(),
                                  backgroundColor: '#d4edda',
                                  color: '#155724',
                                  border: '1px solid #c3e6cb'
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = '#c3e6cb'
                                  e.target.style.color = '#0f4c1b'
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = '#d4edda'
                                  e.target.style.color = '#155724'
                                }}
                              >
                                💾 Save
                              </span>
                              <span
                                onClick={() => {
                                  setEditingResult(null)
                                  // Reset to original data
                                  fetchReviews()
                                }}
                                style={{
                                  ...createCancelButton(),
                                  backgroundColor: colors.light,
                                  color: colors.textMuted,
                                  border: `1px solid ${colors.border}`
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = colors.borderLight
                                  e.target.style.color = colors.text
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = colors.light
                                  e.target.style.color = colors.textMuted
                                }}
                              >
                                ❌ Cancel
                              </span>
                            </>
                          ) : (
                            <span
                              onClick={() => setEditingResult(`${selectedReview.uuid}-${resultIndex}`)}
                              style={{
                                ...createEditButton(),
                                backgroundColor: colors.light,
                                color: colors.textMuted,
                                border: `1px solid ${colors.border}`
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = colors.borderLight
                                e.target.style.color = colors.text
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = colors.light
                                e.target.style.color = colors.textMuted
                              }}
                            >
                              ✏️ Edit
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rule Content (if available) */}
                      {rule && (
                        <div style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                          backgroundColor: colors.light,
                          padding: '8px',
                          borderRadius: '4px',
                          marginBottom: '12px',
                          fontFamily: 'monospace'
                        }}>
                          <strong>Rule:</strong> {rule.content}
                        </div>
                      )}

                      {/* Explanation */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: colors.text,
                          marginBottom: '4px'
                        }}>
                          Explanation:
                        </label>
                        {isEditing ? (
                          <textarea
                            value={result.explanation || ''}
                            onChange={(e) => {
                              const updatedResult = { ...result, explanation: e.target.value }
                              const updatedResults = [...selectedReview.results]
                              updatedResults[resultIndex] = updatedResult
                              setSelectedReview({ ...selectedReview, results: updatedResults })
                            }}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '8px',
                              fontSize: '14px',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              resize: 'vertical'
                            }}
                          />
                        ) : (
                          <div style={{
                            fontSize: '14px',
                            color: colors.text,
                            lineHeight: '1.5',
                            padding: '8px',
                            backgroundColor: colors.light,
                            borderRadius: '4px'
                          }}>
                            {result.explanation || 'No explanation provided'}
                          </div>
                        )}
                      </div>

                      {/* Thinking */}
                      {result.thinking && (
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: colors.text,
                            marginBottom: '4px'
                          }}>
                            Thinking:
                          </label>
                          {isEditing ? (
                            <textarea
                              value={result.thinking || ''}
                              onChange={(e) => {
                                const updatedResult = { ...result, thinking: e.target.value }
                                const updatedResults = [...selectedReview.results]
                                updatedResults[resultIndex] = updatedResult
                                setSelectedReview({ ...selectedReview, results: updatedResults })
                              }}
                              style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '8px',
                                fontSize: '12px',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                resize: 'vertical',
                                fontFamily: 'monospace'
                              }}
                            />
                          ) : (
                            <details style={{ marginTop: '8px' }}>
                              <summary style={{
                                fontSize: '12px',
                                color: colors.textMuted,
                                cursor: 'pointer',
                                padding: '4px',
                                backgroundColor: colors.borderLight,
                                borderRadius: '4px'
                              }}>
                                View detailed thinking process
                              </summary>
                              <div style={{
                                fontSize: '12px',
                                color: colors.text,
                                lineHeight: '1.4',
                                padding: '8px',
                                backgroundColor: colors.light,
                                borderRadius: '4px',
                                marginTop: '4px',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '300px',
                                overflow: 'auto'
                              }}>
                                {result.thinking}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {getFilteredResults(selectedReview).length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: colors.textMuted,
                    fontSize: '14px'
                  }}>
                    No results match the current filters
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: colors.textMuted,
            fontSize: '16px'
          }}>
            Select a review to view details
          </div>
        )}
      </div>
    </div>
  )
}