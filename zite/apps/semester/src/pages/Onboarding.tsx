import { useState } from 'react';
import { toast } from 'sonner';
import { onboard, manageTask } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Upload, CalendarDays, FlaskConical } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import SyllabusImport, { DraftTask } from '../components/SyllabusImport';
import { SourceTag, errMsg } from '../components/kit';

type Role = 'Student' | 'Faculty' | 'Advisor' | 'Administrator';
const CONSENTS = [
  { key: 'assistant' as const, title: 'Let Ask Semester read your course materials?', what: 'Ask Semester reads only records you can already see: your tasks, courses and notes.', who: 'No one else. Answers stay in your account.', how: 'Until you turn it off in You → Privacy & data.' },
  { key: 'directory' as const, title: 'Show you in the campus directory?', what: 'Your name and the groups you join.', who: 'Members of your institution.', how: 'Until you turn it off.' },
];

function Choice({ active, onClick, title, note }: { active: boolean; onClick: () => void; title: React.ReactNode; note: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center justify-between rounded-md border p-4 text-left font-sans transition-colors', active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted')}>
      <span>{title}</span><span className="text-sm text-muted-foreground">{note}</span>
    </button>
  );
}

export default function Onboarding({ onDone, name }: { onDone: () => void; name: string }) {
  const [step, setStep] = useState(1);
  const [workspace, setWorkspace] = useState<'sample' | 'personal' | 'invite'>('sample');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<Role>('Student');
  const [first, setFirst] = useState<'syllabus' | 'sample' | 'none'>('sample');
  const [items, setItems] = useState<DraftTask[]>([]);
  const [consents, setConsents] = useState({ assistant: false, directory: false });
  const [ci, setCi] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = async (final = consents) => {
    setBusy(true);
    try {
      await onboard({ workspace, inviteCode: workspace === 'invite' ? code : undefined, role, useSample: first === 'sample', consents: final });
      if (first === 'syllabus' && items.length) await manageTask({ action: 'bulkCreate', items });
      onDone();
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const decide = (v: boolean) => {
    const next = { ...consents, [CONSENTS[ci].key]: v };
    setConsents(next);
    if (ci < CONSENTS.length - 1) setCi(ci + 1); else finish(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar px-8 py-4 font-display tracking-[0.3em] text-sidebar-accent-foreground">SEMESTER</header>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="eyebrow">Step {step} of 4</p>
        {step === 1 && (<>
          <h1 className="mt-2 text-4xl">Where do you study{name ? `, ${name}` : ''}?</h1>
          <p className="mt-2 text-muted-foreground">Semester starts with what you have. It works alongside your school’s systems and doesn’t replace them.</p>
          <div className="mt-6 space-y-2">
            <Choice active={workspace === 'sample'} onClick={() => { setWorkspace('sample'); if (role === 'Administrator') setRole('Student'); }} title={<>Northgate University <span className="ml-2"><SourceTag source="Sample" /></span></>} note="Open for demo" />
            <Choice active={workspace === 'personal'} onClick={() => setWorkspace('personal')} title="Personal workspace" note="Only you" />
            <Choice active={workspace === 'invite'} onClick={() => { setWorkspace('invite'); if (role === 'Administrator') setRole('Student'); }} title="I have an invite code" note="Needs approval" />
          </div>
          {workspace === 'invite' && <Input className="mt-3 font-mono uppercase" placeholder="e.g. K7QM2X" value={code} onChange={(e) => setCode(e.target.value)} />}
          <p className="mt-3 text-xs text-muted-foreground">Institutions are invite-only. Your administrator gives you a code, and your membership stays pending until they approve it.</p>
        </>)}
        {step === 2 && (<>
          <h1 className="mt-2 text-4xl">What’s your role?</h1>
          <p className="mt-2 text-muted-foreground">Your role decides your workspace and what you can see. Everyone also gets a student workspace in the sample.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {(['Student', 'Faculty', 'Advisor', 'Administrator'] as Role[]).filter((r) => workspace === 'personal' || r !== 'Administrator').map((r) => <Choice key={r} active={role === r} onClick={() => setRole(r)} title={r} note="" />)}
          </div>
        </>)}
        {step === 3 && (<>
          <h1 className="mt-2 text-4xl">Pick a first step</h1>
          <div className="mt-6 space-y-2">
            <Choice active={first === 'syllabus'} onClick={() => setFirst('syllabus')} title={<span className="flex items-center gap-2"><Upload className="h-4 w-4" strokeWidth={1.5} />Add a syllabus</span>} note="Dates become tasks" />
            <div className="flex items-center justify-between rounded-md border border-dashed border-border p-4 text-muted-foreground"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" strokeWidth={1.5} />Connect a calendar</span><span className="text-sm">Off until your school allows it</span></div>
            <Choice active={first === 'sample'} onClick={() => setFirst('sample')} title={<span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" strokeWidth={1.5} />Use sample data</span>} note="Labeled Sample" />
          </div>
          {first === 'syllabus' && <div className="mt-4 rounded-md border border-border bg-card p-4"><SyllabusImport items={items} setItems={setItems} /></div>}
        </>)}
        {step === 4 && (
          <div className="mt-2 rounded-md border border-border bg-card p-6">
            <p className="eyebrow">Decision {ci + 1} of {CONSENTS.length}</p>
            <h1 className="mt-2 text-3xl">{CONSENTS[ci].title}</h1>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="font-medium">What</dt><dd className="text-muted-foreground">{CONSENTS[ci].what}</dd></div>
              <div><dt className="font-medium">With whom</dt><dd className="text-muted-foreground">{CONSENTS[ci].who}</dd></div>
              <div><dt className="font-medium">For how long</dt><dd className="text-muted-foreground">{CONSENTS[ci].how}</dd></div>
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>No, thanks</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(true)}>Yes, allow</Button>
            </div>
          </div>
        )}
        {step < 4 && (
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => (step === 3 ? (setFirst('none'), setStep(4)) : step > 1 ? setStep(step - 1) : setStep(2))}>{step === 3 ? 'Skip for now' : step > 1 ? 'Back' : 'Skip for now'}</Button>
            <Button disabled={step === 1 && workspace === 'invite' && code.trim().length < 4} onClick={() => setStep(step + 1)}>Continue</Button>
          </div>
        )}
        {step === 4 && <button className="mt-4 text-sm text-muted-foreground underline" disabled={busy} onClick={() => finish()}>{busy ? 'Setting up your workspace…' : 'Skip remaining questions'}</button>}
      </div>
    </div>
  );
}
