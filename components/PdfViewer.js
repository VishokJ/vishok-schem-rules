import { useState } from 'react'
import { Document, Page } from 'react-pdf'

export default function PdfViewer({ url }) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages)
  }

  const buttonStyle = {
    padding: '8px 16px',
    border: '2px solid #007bff',
    backgroundColor: '#fff',
    color: '#007bff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    outline: 'none'
  }

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#f8f9fa',
    borderColor: '#dee2e6',
    color: '#6c757d',
    cursor: 'not-allowed'
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        marginBottom: '16px', 
        textAlign: 'center',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <button 
          onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          style={pageNumber <= 1 ? disabledButtonStyle : buttonStyle}
          onMouseOver={(e) => {
            if (pageNumber > 1) {
              e.target.style.backgroundColor = '#007bff'
              e.target.style.color = '#fff'
            }
          }}
          onMouseOut={(e) => {
            if (pageNumber > 1) {
              e.target.style.backgroundColor = '#fff'
              e.target.style.color = '#007bff'
            }
          }}
        >
          ← Previous
        </button>
        <span style={{ 
          margin: '0 20px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#495057'
        }}>
          Page {pageNumber} of {numPages}
        </span>
        <button 
          onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
          disabled={pageNumber >= numPages}
          style={pageNumber >= numPages ? disabledButtonStyle : buttonStyle}
          onMouseOver={(e) => {
            if (pageNumber < numPages) {
              e.target.style.backgroundColor = '#007bff'
              e.target.style.color = '#fff'
            }
          }}
          onMouseOut={(e) => {
            if (pageNumber < numPages) {
              e.target.style.backgroundColor = '#fff'
              e.target.style.color = '#007bff'
            }
          }}
        >
          Next →
        </button>
      </div>
      
      <div style={{ 
        border: '2px solid #dee2e6', 
        borderRadius: '8px',
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#fff'
      }}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div style={{ 
              padding: '40px', 
              textAlign: 'center',
              color: '#6c757d',
              fontSize: '16px'
            }}>
              📄 Loading PDF...
            </div>
          }
          error={
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: '#dc3545',
              fontSize: '16px'
            }}>
              ❌ Failed to load PDF
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            width={Math.min(500, window.innerWidth * 0.4)}
            loading={
              <div style={{ 
                padding: '20px', 
                textAlign: 'center',
                color: '#6c757d'
              }}>
                Loading page...
              </div>
            }
          />
        </Document>
      </div>
    </div>
  )
}