import { useState } from 'react'

export default function PinTable({ pinData }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!pinData) return null

  let pins = []
  try {
    const parsed = typeof pinData === 'string' ? JSON.parse(pinData) : pinData
    pins = parsed.pins || []
  } catch (error) {
    console.error('Error parsing pin data:', error)
    return (
      <div style={{ 
        color: '#dc3545',
        padding: '16px',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '8px'
      }}>
        ❌ Error parsing pin table data
      </div>
    )
  }

  if (pins.length === 0) return null

  const headers = pins[0] || []
  const rows = pins.slice(1) || []

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
          📌 Pin Table
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
        <div style={{ 
          overflow: 'auto',
          border: '2px solid #dee2e6',
          borderRadius: '8px',
          backgroundColor: '#fff',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ 
                backgroundColor: '#e3f2fd',
                borderBottom: '2px solid #90caf9'
              }}>
                {headers.map((header, index) => (
                  <th key={index} style={{
                    border: 'none',
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#1565c0',
                    fontSize: '14px'
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{
                  backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = rowIndex % 2 === 0 ? '#fff' : '#f8f9fa'}
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{
                      border: 'none',
                      padding: '12px 16px',
                      verticalAlign: 'top',
                      whiteSpace: 'pre-wrap',
                      color: '#495057',
                      lineHeight: '1.5'
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}