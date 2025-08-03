export default function PdfViewer({ url }) {
  if (!url) return null

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
        <span style={{ 
          fontSize: '14px',
          fontWeight: '600',
          color: '#495057'
        }}>
          📄 PDF Datasheet
        </span>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            marginLeft: '16px',
            padding: '6px 12px',
            backgroundColor: '#007bff',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          Open in New Tab
        </a>
      </div>
      
      <div style={{ 
        border: '2px solid #dee2e6', 
        borderRadius: '8px',
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}>
        <iframe
          src={url}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          title="PDF Datasheet"
        />
      </div>
    </div>
  )
}