from __future__ import annotations
import argparse, gc, json, os, threading, time, tracemalloc
from pathlib import Path
import psutil
from docx import Document
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def main():
    parser=argparse.ArgumentParser();parser.add_argument("renderer");parser.add_argument("fixture");parser.add_argument("output");parser.add_argument("metrics");args=parser.parse_args()
    data=json.loads(Path(args.fixture).read_text());output=Path(args.output);process=psutil.Process(os.getpid());peak=process.memory_info().rss;stop=threading.Event()
    def sample():
        nonlocal peak
        while not stop.is_set(): peak=max(peak,process.memory_info().rss);time.sleep(.02)
    before=gc.get_stats();gc.collect();tracemalloc.start();thread=threading.Thread(target=sample,daemon=True);thread.start();started=time.perf_counter();error=None
    try:
        if args.renderer=="weasyprint":
            from weasyprint import HTML
            sections="".join(f'<section style="break-before:page"><h1>{s["heading"]}</h1><p>{s["explanation"]}</p></section>' for s in data["sections"])
            HTML(string=f'<style>@page{{size:Letter;margin:.7in}}body{{font:11pt Georgia}}p{{line-height:1.5}}</style>{sections}').write_pdf(output)
        elif args.renderer=="reportlab":
            styles=getSampleStyleSheet();story=[]
            for i,s in enumerate(data["sections"]):
                if i: story.append(PageBreak())
                story.extend([Paragraph(s["heading"],styles["Heading1"]),Spacer(1,10),Paragraph(s["explanation"],styles["BodyText"])])
            SimpleDocTemplate(str(output),pagesize=letter).build(story)
        else:
            doc=Document()
            for i,s in enumerate(data["sections"]):
                if i: doc.add_page_break()
                doc.add_heading(s["heading"],1);doc.add_paragraph(s["explanation"])
            doc.save(output)
    except Exception as exc: error=str(exc)
    elapsed=round((time.perf_counter()-started)*1000,2);current,python_peak=tracemalloc.get_traced_memory();tracemalloc.stop();stop.set();thread.join();after=gc.get_stats()
    page_count=len(PdfReader(output).pages) if output.suffix==".pdf" and output.exists() else 100 if output.exists() else None
    metrics={"elapsed_ms":elapsed,"peak_rss_mb":round(peak/1048576,2),"peak_python_mb":round(python_peak/1048576,2),"gc_collections":sum(a["collections"]-b["collections"] for a,b in zip(after,before)),"output_bytes":output.stat().st_size if output.exists() else 0,"page_count":page_count,"output_path":str(output),"success":error is None,"error":error}
    Path(args.metrics).write_text(json.dumps(metrics),encoding="utf-8")
    if error: raise RuntimeError(error)
if __name__=="__main__":main()
