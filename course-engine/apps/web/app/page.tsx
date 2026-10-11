import { AuthLaunch } from "@/components/auth-launch";
import { CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";

export default function Home() {
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
    <section className="flex min-h-[42vh] flex-col justify-between bg-[color:var(--ink-950)] p-8 text-[color:var(--text-inverse)] lg:min-h-screen lg:p-14">
      <p className="font-[family-name:var(--font-editorial)] tracking-[0.12em]">SEMESTER</p>
      <div className="max-w-xl py-14"><p className="text-sm text-[color:var(--semester-300)]">Course workspace</p><h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[0.95] lg:text-7xl">Study from evidence, not guesses.</h1><p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[color:var(--text-inverse-muted)]">Upload course materials once. Semester keeps deadlines, study assets, and corrections linked to the original source.</p></div>
      <ul className="grid gap-4 text-sm text-[color:var(--text-inverse-muted)] sm:grid-cols-3"><li className="flex gap-2"><ShieldCheck aria-hidden="true" className="text-[color:var(--semester-300)]" size={18} /> Source-aware</li><li className="flex gap-2"><FileSearch aria-hidden="true" className="text-[color:var(--semester-300)]" size={18} /> Reviewable</li><li className="flex gap-2"><CheckCircle2 aria-hidden="true" className="text-[color:var(--semester-300)]" size={18} /> Candid states</li></ul>
    </section>
    <section className="grid place-items-center p-6 sm:p-10"><div className="w-full max-w-lg"><p className="eyebrow">Your semester</p><h2 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold">Open a course workspace</h2><p className="muted reading-width mt-3">Institutional, connected, student-entered, estimated, and AI-assisted information remain visibly distinct.</p><AuthLaunch /></div></section>
  </main>;
}
