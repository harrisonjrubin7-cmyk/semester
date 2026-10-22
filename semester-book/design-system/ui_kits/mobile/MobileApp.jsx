function Phone({ start, dark }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [tab, setTab] = React.useState(start);
  const S = { today: window.MToday, path: window.MPath, search: window.MSearch, plan: window.MPlan, me: window.MMe };
  const Screen = S[tab];
  return (
    <div className="phone"><div className="screen" data-theme={dark ? 'dark' : undefined}>
      <div className="status"><span>9:41</span><N.Wordmark size={13} showWord={false} /></div>
      <Screen go={setTab} />
      <N.TabBar current={tab} onNavigate={setTab} items={[{ id: 'today', label: 'Today', icon: 'today' }, { id: 'path', label: 'My Path', icon: 'pathway' }, { id: 'search', label: 'Search', icon: 'search' }, { id: 'plan', label: 'Plan', icon: 'calendar' }, { id: 'me', label: 'Me', icon: 'profile' }]} />
    </div></div>
  );
}
function MobileApp() { return <><Phone start="today" /><Phone start="path" dark /></>; }
ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
