import { useEffect, useRef, useState } from "react";
import { getDocument } from "pdfjs-dist";
import "../bank/pdf";

export function Preview({ blob, page }: { blob: Blob; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof getDocument> | undefined;
    const render = async () => {
      const bytes = await blob.arrayBuffer(); if (disposed) return;
      task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
      const pdf = await task.promise;
      if (disposed || !canvas.current) return;
      const source = await pdf.getPage(page), viewport = source.getViewport({ scale: .9 });
      const target = canvas.current; target.width = viewport.width; target.height = viewport.height;
      const context = target.getContext("2d"); if (!context || disposed) return;
      await source.render({ canvas: target, canvasContext: context, viewport }).promise;
    };
    render().catch(() => { if (!disposed) setError("Preview unavailable. Download the PDF to view it."); });
    return () => { disposed = true; void task?.destroy(); };
  }, [blob, page]);
  return <div className="af-preview">{error ? <p role="status">{error}</p> : <canvas ref={canvas} aria-label={`Class PDF preview, page ${page}`} />}</div>;
}
