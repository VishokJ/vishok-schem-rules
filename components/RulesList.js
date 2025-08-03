import { useState } from 'react'

export default function RulesList({ rules }) {
  const [collapsedCategories, setCollapsedCategories] = useState({})
  const [isCollapsed, setIsCollapsed] = useState(false)

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
                {categoryRules.map((rule, index) => (
                  <div key={index} style={{
                    marginBottom: '12px',
                    padding: '16px',
                    backgroundColor: getLevelColor(rule.level),
                    border: getLevelBorder(rule.level),
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
                      marginBottom: '8px'
                    }}>
                      <span style={{ marginRight: '8px', fontSize: '16px' }}>
                        {getLevelIcon(rule.level)}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: rule.level === 'ESSENTIAL' ? '#dc3545' : '#ffc107',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '4px 8px',
                        backgroundColor: rule.level === 'ESSENTIAL' ? '#f8d7da' : '#fff3cd',
                        borderRadius: '4px',
                        border: `1px solid ${rule.level === 'ESSENTIAL' ? '#f5c6cb' : '#ffeaa7'}`
                      }}>
                        {rule.level}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      color: '#495057'
                    }}>
                      {rule.content}
                    </div>
                  </div>
                ))}
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