import { useEffect, useRef, useState } from 'react';
import Signing from './Signing';
import PdfPages from './PdfPages';
import './PdfViewer.css';

/** The Bill of Lading filled from the signed estimate: read it, sign it, download it. */
export default function BillOfLadingViewer({ base, headers, customerName, filename, onSigned, onClose }: {
  base: string; headers: Record<string, string>; customerName: string; filename: string;
  onSigned: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [revision, setRevision] = useState('');
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function load() {
    setError('');
    try {
      const response = await fetch(`${base}/bill-of-lading.pdf`, { headers, cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(typeof result.detail === 'string' ? result.detail : `Could not open the Bill of Lading (HTTP ${response.status}).`);
      }
      setRevision(response.headers.get('X-Revision') || '');
      setSigned(response.headers.get('X-Signed') === '1');
      setUrl(URL.createObjectURL(await response.blob()));
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  return <dialog ref={dialog} className="pdf-viewer" aria-labelledby="bill-of-lading-title" onCancel={e => { e.preventDefault(); if (!signing) onClose(); }}>
    <header className="pdf-viewer-header">
      <div><h2 id="bill-of-lading-title">Bill of Lading</h2><p>{signed ? 'Your signature has been saved.' : 'Review the Bill of Lading, then click Sign here on it.'}</p></div>
      <div className="pdf-viewer-actions">
        {url && <a className="cm-secondary-btn" href={url} download={filename}>Download PDF</a>}
        <button className="cm-secondary-btn" disabled={signing} onClick={onClose} aria-label="Close Bill of Lading">Close</button>
      </div>
    </header>
    {error && <p role="alert">{error}</p>}
    <div className="pdf-viewer-content">
      {url ? <PdfPages url={url} title="Bill of Lading PDF" onSign={signed ? undefined : () => setSigning(true)} /> : !error && <p role="status">Preparing your Bill of Lading...</p>}
      {signing && <aside><Signing path="/bill-of-lading" paper="Bill of Lading" base={base} headers={headers} customerName={customerName} disabled={false} version={revision} hideHistory
        onClose={() => setSigning(false)} onSigned={() => { setSigning(false); onSigned(); void load(); }} /></aside>}
    </div>
  </dialog>;
}
