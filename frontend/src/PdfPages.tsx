import { useEffect, useRef, useState } from 'react';

// The estimate PDF's empty signature area is a link to this name (estimate_pdf.SignHere).
const SIGN_HERE = 'sign-here';

type SignArea = { page: number; left: number; top: number; width: number; height: number };

/** The PDF's pages, drawn to fit the width. With onSign, its signature area opens signing when clicked. */
export default function PdfPages({ url, title, onSign }: { url: string; title: string; onSign?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [signArea, setSignArea] = useState<SignArea | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setPages([]); setSignArea(null); setError('');
    (async () => {
      // Loaded with the viewer only, so the rest of the page does not carry it.
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const loading = pdfjs.getDocument(url);
      task = loading;
      const pdf = await loading.promise;
      const width = container.current?.clientWidth || 800;
      const drawn: HTMLCanvasElement[] = [];
      let area: SignArea | null = null;
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
        if (cancelled) return;
        drawn.push(canvas);
        if (!area) {
          const link = (await page.getAnnotations()).find(annotation => annotation.subtype === 'Link' && annotation.dest === SIGN_HERE);
          if (link) {
            const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(link.rect);
            // As shares of the page, so the area stays on the line when the page is shown narrower or wider.
            area = { page: number - 1, left: Math.min(x1, x2) / viewport.width, top: Math.min(y1, y2) / viewport.height,
              width: Math.abs(x2 - x1) / viewport.width, height: Math.abs(y2 - y1) / viewport.height };
          }
        }
        setPages([...drawn]);
      }
      if (!cancelled) setSignArea(area);
    })().catch(reason => { if (!cancelled) setError((reason as Error).message || 'Could not show the PDF.'); });
    return () => { cancelled = true; void task?.destroy(); };
  }, [url]);

  return <div ref={container} className="pdf-pages" role="document" aria-label={title}>
    {error && <p role="alert">Could not show the PDF. Use Download PDF to open it. ({error})</p>}
    {!error && !pages.length && <p role="status">Loading PDF...</p>}
    {pages.map((canvas, index) => <div key={index} className="pdf-page">
      <div ref={holder => { if (holder && holder.firstChild !== canvas) holder.replaceChildren(canvas); }} />
      {onSign && signArea?.page === index && <button type="button" className="pdf-sign-here" onClick={onSign}
        style={{ left: `${signArea.left * 100}%`, top: `${signArea.top * 100}%`, width: `${signArea.width * 100}%`, height: `${signArea.height * 100}%` }}>Click here to sign</button>}
    </div>)}
  </div>;
}
