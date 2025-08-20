import { useState } from 'react'
import { createEditButton, createSaveButton, createCancelButton } from '../lib/styles'
import { useTheme } from '../lib/ThemeContext'

export default function RulesList({ rules, onUpdateRule }) {
  const { colors } = useTheme()
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
        return colors.essentialBg
      case 'RECOMMENDED':
        return colors.recommendedBg
      default:
        return colors.light
    }
  }

  const getLevelBorder = (level) => {
    switch (level) {
      case 'ESSENTIAL':
        return `2px solid ${colors.essentialBorder}`
      case 'RECOMMENDED':
        return `2px solid ${colors.recommendedBorder}`
      default:
        return `1px solid ${colors.border}`
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
          padding: '16px',
          backgroundColor: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: isCollapsed ? '0' : '16px',
          transition: 'all 0.2s',
          userSelect: 'none'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.light}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.white}
      >
        <h3 style={{ 
          margin: '0',
          color: colors.text,
          fontSize: '16px',
          fontWeight: '600'
        }}>
          📋 Rules
        </h3>
        <span style={{ 
          fontSize: '16px',
          color: colors.textMuted,
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
                backgroundColor: colors.white,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.light}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.white}
            >
              <span>📂 {category}</span>
              <span style={{ 
                fontSize: '14px',
                color: colors.textMuted,
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
                              color: currentLevel === 'ESSENTIAL' ? colors.essentialBorder : colors.recommendedBorder,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '4px 8px',
                              backgroundColor: currentLevel === 'ESSENTIAL' ? colors.essentialBg : colors.recommendedBg,
                              borderRadius: '4px',
                              border: `1px solid ${currentLevel === 'ESSENTIAL' ? colors.essentialBorder : colors.recommendedBorder}`,
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
                          ) : (
                            <span
                              onClick={() => cancelEditing(rule, index)}
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
                          )}
                          
                          {showSaveButton && (
                            <span
                              onClick={() => saveRule(rule, index)}
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
                            border: `2px solid ${colors.primary}`,
                            borderRadius: '4px',
                            resize: 'vertical',
                            outline: 'none',
                            backgroundColor: colors.white,
                            color: colors.text,
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <div style={{ 
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          color: colors.text,
                          padding: '8px',
                          backgroundColor: colors.light,
                          borderRadius: '4px'
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