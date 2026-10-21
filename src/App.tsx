import { BookOpen, FlaskConical, Home, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toggle, cx } from './components/ui';
import { useSettings } from './lib/settings';
import { DemoProvider, useDemo } from './pages/demo/DemoContext';
import { GuidedDemo } from './pages/demo/GuidedDemo';
import { Experiments } from './pages/Experiments';
import { Learn } from './pages/Learn';
import { Overview } from './pages/Overview';

export type Page = 'overview' | 'demo' | 'experiments' | 'learn';
const NAV: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'demo', label: 'Guided Demo', icon: PlayCircle },
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
  { id: 'learn', label: 'Learn', icon: BookOpen },
];

function pageFromHash(): Page {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (NAV.find((n) => n.id === h)?.id ?? 'overview') as Page;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0F766E" />
        <path d="M4 16c3 0 3-8 6-8s3 16 6 16 3-16 6-16 3 8 6 8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className="font-semibold text-ink">SignalLab</div>
        <div className="text-[11px] text-ink-faint">Wireless Communication Simulator</div>
      </div>
    </div>
  );
}

function Shell() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const { presentation } = useDemo();
  const { showTechnical, setShowTechnical } = useSettings();

  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const navigate = useCallback((p: Page) => {
    window.location.hash = `/${p}`;
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const label = NAV.find((n) => n.id === page)?.label;
    document.title = page === 'overview' ? 'SignalLab | ASK vs FSK' : `${label} · SignalLab`;
  }, [page]);

  const hideNav = presentation && page === 'demo';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      {!hideNav && (
        <>
          {/* Desktop sidebar */}
          <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
            <Logo />
            <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Software Simulation
            </span>
            <nav aria-label="Main" className="mt-8 space-y-1">
              {NAV.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(id);
                  }}
                  aria-current={page === id ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    page === id ? 'bg-accent-light/70 text-accent' : 'text-ink-soft hover:bg-slate-100 hover:text-ink',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-auto border-t border-line pt-4">
              <Toggle checked={showTechnical} onChange={setShowTechnical} label="Technical notes" description="Show extra engineering detail throughout the app." />
            </div>
          </aside>

          {/* Mobile / tablet top bar */}
          <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Logo />
              <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-medium text-accent">Software Simulation</span>
            </div>
            <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
              {NAV.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(id);
                  }}
                  aria-current={page === id ? 'page' : undefined}
                  className={cx(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
                    page === id ? 'bg-accent-light/70 text-accent' : 'text-ink-soft hover:bg-slate-100',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                aria-pressed={showTechnical}
                className={cx('ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm', showTechnical ? 'text-accent' : 'text-ink-faint')}
              >
                Tech notes {showTechnical ? 'on' : 'off'}
              </button>
            </nav>
          </header>
        </>
      )}

      <main id="main" className={cx('px-4 py-6 sm:px-6 lg:py-8', !hideNav && 'lg:ml-60 lg:px-10')}>
        {page === 'overview' && <Overview navigate={navigate} />}
        {page === 'demo' && <GuidedDemo />}
        {page === 'experiments' && <Experiments />}
        {page === 'learn' && <Learn navigate={navigate} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}
