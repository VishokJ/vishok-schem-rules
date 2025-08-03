import { pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.js`

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}