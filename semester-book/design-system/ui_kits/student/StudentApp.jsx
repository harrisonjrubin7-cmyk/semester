const SA_TWEAKS = /*EDITMODE-BEGIN*/{"theme":"light","density":"comfortable","textSize":"normal","dataState":"live","reducedMotion":false}/*EDITMODE-END*/;
function StudentApp() {
  const [tw, setTw] = window.useTweaks(SA_TWEAKS);
  React.useEffect(() => { const r = document.documentElement; r.setAttribute('data-theme', tw.theme === 'dark' ? 'dark' : 'light'); r.style.setProperty('--density', { comfortable: 1, snug: .86, tight: .74 }[tw.density]); r.style.setProperty('--text-scale', { compact: .94, normal: 1, large: 1.09, largest: 1.18 }[tw.textSize]); if (tw.reducedMotion) r.setAttribute('data-calm', 'still'); else r.removeAttribute('data-calm'); }, [tw]);
  const N = window.SemesterDesignSystem_e9f3ba; const d = window.studentData;
  const [screen, setScreen] = React.useState(() => localStorage.getItem('sem-student-screen') || 'today');
  const [palette, setPalette] = React.useState(false);
  const go = (s) => { setScreen(s); localStorage.setItem('sem-student-screen', s); };
  React.useEffect(() => { const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette(true); } if (e.key === 'Escape') setPalette(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const S = { today: 'TodayScreen', directory: 'DirectoryScreen', notifs: 'NotificationsScreen', calendar: 'CalendarScreen', registration: 'RegistrationScreen', career: 'CareerScreen', billing: 'BillingScreen', course: 'CourseScreen', grades: 'GradesScreen', study: 'StudyScreen', assistant: 'AssistantScreen', write: 'WriteScreen', sheet: 'SheetScreen', deck: 'DeckScreen', support: 'SupportScreen', family: 'FamilyScreen', campus: 'CampusScreen', maps: 'MapsScreen', mail: 'MailScreen', community: 'CommunityScreen', me: 'MeScreen', degree: 'DegreeScreen', advising: 'AdvisingScreen', settings: 'SettingsScreen', connect: 'ConnectScreen', privacy: 'PrivacyScreen', meals: 'MealsScreen', housing: 'HousingScreen', exam: 'ExamScreen', opportunities: 'OpportunitiesScreen', activities: 'ActivitiesScreen', profile: 'ProfileScreen', hub: 'HubScreen', announce: 'AnnounceScreen', yes: 'YesScreen', runway: 'RunwayScreen', pathway: 'PathwayScreen', applying: 'ApplyingScreen', launchpad: 'LaunchpadScreen', mine: 'MineScreen', import: 'ImportScreen', sources: 'SourcesScreen', meet: 'MeetScreen', analyse: 'AnalyseScreen', solve: 'SolveScreen', work: 'WorkScreen', clocks: 'ClocksScreen', groupwork: 'GroupworkScreen', draw: 'DrawScreen', equations: 'EquationsScreen', create: 'CreateScreen', essay: 'EssayScreen', proof: 'ProofScreen', behind: 'BehindScreen', people: 'PeopleScreen', help: 'HelpScreen', university: 'UniversityScreen', classmates: 'ClassmatesScreen', links: 'LinksScreen', call: 'CallScreen', athletics: 'AthleticsScreen', nil: 'NilScreen', brief: 'BriefScreen', account: 'AccountScreen', export: 'ExportScreen' };
  const built = Object.fromEntries(Object.keys(S).map((k) => [k, true]));
  const area = window.NAV_AREAS.find((a) => a.screens.some(([s]) => s === screen));
  const label = screen === 'directory' ? 'App directory' : ((area && area.screens.find(([s]) => s === screen)) || [0, 'Today'])[1];
  const Screen = window[S[screen]];
  const ic = { today: 'today', plan: 'calendar', learn: 'study', help: 'support', campus: 'campus', progress: 'pathway', you: 'profile' };
  const pick = { today: ['today', 'notifs'], plan: ['calendar', 'registration', 'career', 'billing'], learn: ['course', 'study', 'assistant', 'write', 'sheet', 'deck', 'grades'], help: ['support', 'family'], campus: ['campus', 'maps', 'mail', 'community'], progress: ['me', 'degree', 'advising'], you: ['settings', 'connect', 'privacy'] };
  const groups = [{ items: [{ id: 'directory', label: 'App directory', icon: 'apps' }] }, ...window.NAV_AREAS.map((a) => ({ label: a.label, items: pick[a.id].map((id) => { const s = a.screens.find(([x]) => x === id); return { id, label: s[1], icon: s[2] }; }) }))];
  return (
    <div className="shell">
      <N.SideRail current={screen} onNavigate={go} groups={groups} foot={<><div style={{ color: 'var(--chrome-text)' }}>{d.name}</div><div>{d.school}</div></>} />
      <div className="main">
        <N.SystemContextBar location={(area && area.label !== label ? area.label + ' · ' : '') + label} term={d.term} sync="synced" onSearch={() => setPalette(true)} actions={<><N.IconButton icon="bell" label="Notifications" size="sm" onClick={() => go('notifs')} /><N.IconButton icon="settings" label="Settings" size="sm" onClick={() => go('settings')} /></>} />
        <div className="scroll" key={screen + tw.dataState}>{tw.dataState === 'live' ? (Screen ? <Screen go={go} built={built} /> : <window.OutlineScreen id={screen} go={go} />) : <div className="page"><div className="pagehead"><div><div className="kicker">{label}</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>{label}</h1></div></div>{tw.dataState === 'loading' && <N.LoadingState what={label} />}{tw.dataState === 'empty' && <N.EmptyState title={'Nothing in ' + label + ' yet'} body="Items appear here once your school or you add them." action={<N.Button size="sm" icon="plus">Add something</N.Button>} />}{tw.dataState === 'offline' && <div className="stack"><N.OfflineStrip queued={2} />{Screen && <Screen go={go} built={built} />}</div>}{tw.dataState === 'error' && <N.ErrorState title={label + ' didn’t load'} body="Your work is safe on this device. Semester will retry automatically." secondaryLabel="Use the school portal" reference="SYNC-4F2A" />}</div>}</div>
      </div>
      <window.TweaksPanel>
        <window.TweakSection label="Appearance" />
        <window.TweakRadio label="Theme" value={tw.theme} options={['light', 'dark']} onChange={(v) => setTw('theme', v)} />
        <window.TweakRadio label="Density" value={tw.density} options={['comfortable', 'snug', 'tight']} onChange={(v) => setTw('density', v)} />
        <window.TweakSelect label="Text size" value={tw.textSize} options={['compact', 'normal', 'large', 'largest']} onChange={(v) => setTw('textSize', v)} />
        <window.TweakToggle label="Reduced motion" value={tw.reducedMotion} onChange={(v) => setTw('reducedMotion', v)} />
        <window.TweakSection label="Data" />
        <window.TweakSelect label="Data state" value={tw.dataState} options={['live', 'loading', 'empty', 'offline', 'error']} onChange={(v) => setTw('dataState', v)} />
        <window.TweakSection label="Role" />
        <window.TweakSelect label="View as" value="Student" options={['Student', 'Staff', 'Console', 'External', 'Role lens']} onChange={(v) => { const u = { Staff: '../staff/index.html', Console: '../console/index.html', External: '../external/index.html', 'Role lens': '../role-lens/index.html' }[v]; if (u) window.location.href = u; }} />
      </window.TweaksPanel>
      {palette && <div className="dialog-scrim" style={{ alignItems: 'start', paddingTop: '12vh' }} onClick={(e) => e.target === e.currentTarget && setPalette(false)}>
        <N.CommandPalette onSelect={(it) => { setPalette(false); if (it.go) go(it.go); }} groups={[...window.NAV_AREAS.map((a) => ({ label: a.label, items: a.screens.map(([id, l, i]) => ({ label: l, icon: i, go: id, detail: built[id] ? undefined : 'Outline' })) })), { label: 'Ask', items: [{ label: 'Plan my week around the lab report', icon: 'ask', detail: 'AI-assisted', go: 'assistant' }] }]} />
      </div>}
    </div>
  );
}
window.__studentRoot = window.__studentRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__studentRoot.render(<StudentApp />);
