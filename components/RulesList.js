import { useState } from 'react'

export default function RulesList({ rules, onUpdateRule }) {
  const [collapsedCategories, setCollapsedCategories] = useState({})
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [editingRules, setEditingRules] = useState({})
  const [editedContent, setEditedContent] = useState({})
  const [editedLevels, setEditedLevels] = useState({})

  if (!rules || rules.length === 0) return null

  const groupedRules = rules.reduce((groups, rule) => {
    const category = rule.category || 'Uncategorized'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(rule)
    return groups
  }, {})

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'ESSENTIAL':
        return '#fff5f5'
      case 'RECOMMENDED':
        return '#fffbf0'
      default:
        return '#f8f9fa'
    }
  }

  const getLevelBorder = (level) => {
    switch (level) {
      case 'ESSENTIAL':
        return '2px solid #dc3545'
      case 'RECOMMENDED':
        return '2px solid #ffc107'
      default:
        return '1px solid #dee2e6'
    }
  }

  const getLevelIcon = (level) => {
    switch (level) {
      case 'ESSENTIAL':
        return '🔴'
      case 'RECOMMENDED':
        return '🟡'
      default:
        return '⚪'
    }
  }

  const getRuleKey = (rule, index) => rule.uuid || `${rule.category}-${index}`

  const toggleLevel = (rule, index) => {
    const key = getRuleKey(rule, index)
    const currentLevel = editedLevels[key] || rule.level
    const newLevel = currentLevel === 'ESSENTIAL' ? 'RECOMMENDED' : 'ESSENTIAL'
    setEditedLevels(prev => ({ ...prev, [key]: newLevel }))
  }

  const startEditing = (rule, index) => {
    const key = getRuleKey(rule, index)
    setEditingRules(prev => ({ ...prev, [key]: true }))
    setEditedContent(prev => ({ ...prev, [key]: rule.content }))
  }

  const cancelEditing = (rule, index) => {
    const key = getRuleKey(rule, index)
    setEditingRules(prev => ({ ...prev, [key]: false }))
    setEditedContent(prev => ({ ...prev, [key]: rule.content }))
    setEditedLevels(prev => ({ ...prev, [key]: rule.level }))
  }

  const saveRule = async (rule, index) => {
    const key = getRuleKey(rule, index)
    const newContent = editedContent[key] || rule.content
    const newLevel = editedLevels[key] || rule.level
    
    if (onUpdateRule) {
      try {
        await onUpdateRule(rule, { content: newContent, level: newLevel })
        setEditingRules(prev => ({ ...prev, [key]: false }))
      } catch (error) {
        console.error('Failed to save rule:', error)
        alert('Failed to save rule. Please try again.')
      }
    }
  }

  const hasChanges = (rule, index) => {
    const key = getRuleKey(rule, index)
    const contentChanged = editedContent[key] && editedContent[key] !== rule.content
    const levelChanged = editedLevels[key] && editedLevels[key] !== rule.level
    return contentChanged || levelChanged
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#e3f2fd',
          border: '2px solid #90caf9',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: isCollapsed ? '0' : '16px',
          transition: 'all 0.2s',
          userSelect: 'none'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbdefb'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
      >
        <h3 style={{ 
          margin: '0',
          color: '#1565c0',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          📋 Rules
        </h3>
        <span style={{ 
          fontSize: '20px',
          color: '#1565c0',
          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          transition: 'transform 0.2s'
        }}>
          ▶
        </span>
      </div>

      {!isCollapsed && (
        <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
          {Object.entries(groupedRules).map(([category, categoryRules]) => {
            const isCategoryCollapsed = collapsedCategories[category]
        return (
          <div key={category} style={{ marginBottom: '24px' }}>
            <div 
              onClick={() => toggleCategory(category)}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '0 0 12px 0',
                padding: '12px 16px',
                backgroundColor: '#e3f2fd',
                border: '2px solid #90caf9',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1565c0',
                cursor: 'pointer',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbdefb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
            >
              <span>📂 {category}</span>
              <span style={{ 
                fontSize: '16px',
                transform: isCategoryCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                transition: 'transform 0.2s'
              }}>
                ▶
              </span>
            </div>
            
            {!isCategoryCollapsed && (
              <div style={{ 
                paddingLeft: '8px',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                {categoryRules.map((rule, index) => {
                  const key = getRuleKey(rule, index)
                  const isEditing = editingRules[key]
                  const currentLevel = editedLevels[key] || rule.level
                  const currentContent = editedContent[key] || rule.content
                  const showSaveButton = hasChanges(rule, index) || isEditing

                  return (
                    <div key={index} style={{
                      marginBottom: '12px',
                      padding: '16px',
                      backgroundColor: getLevelColor(currentLevel),
                      border: getLevelBorder(currentLevel),
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ marginRight: '8px', fontSize: '16px' }}>
                            {getLevelIcon(currentLevel)}
                          </span>
                          <span 
                            onClick={() => toggleLevel(rule, index)}
                            style={{
                              fontSize: '12px',
                              fontWeight: '700',
                              color: currentLevel === 'ESSENTIAL' ? '#dc3545' : '#ffc107',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '4px 8px',
                              backgroundColor: currentLevel === 'ESSENTIAL' ? '#f8d7da' : '#fff3cd',
                              borderRadius: '4px',
                              border: `1px solid ${currentLevel === 'ESSENTIAL' ? '#f5c6cb' : '#ffeaa7'}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            {currentLevel}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!isEditing ? (
                            <span
                              onClick={() => startEditing(rule, index)}
                              style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#6c757d',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                padding: '3px 6px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '3px',
                                border: '1px solid #dee2e6',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = '#e9ecef'
                                e.target.style.color = '#495057'
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = '#f8f9fa'
                                e.target.style.color = '#6c757d'
                              }}
                            >
                              ✏️ Edit
                            </span>
                          ) : (
                            <span
                              onClick={() => cancelEditing(rule, index)}
                              style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#6c757d',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                padding: '3px 6px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '3px',
                                border: '1px solid #dee2e6',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = '#e9ecef'
                                e.target.style.color = '#495057'
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = '#f8f9fa'
                                e.target.style.color = '#6c757d'
                              }}
                            >
                              ❌ Cancel
                            </span>
                          )}
                          
                          {showSaveButton && (
                            <span
                              onClick={() => saveRule(rule, index)}
                              style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#155724',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                padding: '3px 6px',
                                backgroundColor: '#d4edda',
                                borderRadius: '3px',
                                border: '1px solid #c3e6cb',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                userSelect: 'none'
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
                          )}
                        </div>
                      </div>
                      
                      {isEditing ? (
                        <textarea
                          value={currentContent}
                          onChange={(e) => setEditedContent(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            padding: '8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            resize: 'vertical',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <div style={{ 
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          color: '#495057'
                        }}>
                          {currentContent}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
            )
          })}
        </div>
      )}
    </div>
  )
}