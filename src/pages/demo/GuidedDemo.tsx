import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stepper } from '../../components/Stepper';
import { GhostButton, SecondaryButton, cx } from '../../components/ui';
import { STEP_LABELS, useDemo } from './DemoContext';
import { StepChannel } from './StepChannel';
import { StepCompare } from './StepCompare';
import { StepModulation } from './StepModulation';
import { StepReceive } from './StepReceive';
import { StepSensor } from './StepSensor';
import { StepTransmit } from './StepTransmit';

const STEPS = [StepSensor, StepModulation, StepChannel, StepTransmit, StepReceive, StepCompare];

export function GuidedDemo() {
  const { step, setStep, blocker, maxReachable, presentation, setPresentation } = useDemo();
  const [hint, setHint] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHint(null);
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  // Clear a stale hint as soon as the requirement is met.
  useEffect(() => {
    if (hint && !blocker(step)) setHint(null);
  }, [hint, blocker, step]);

  const goNext = useCallback(() => {
    const b = blocker(step);
    if (b) {
      setHint(b);
      return;
    }
    setStep(Math.min(STEP_LABELS.length - 1, step + 1));
  }, [blocker, step, setStep]);

  const goBack = useCallback(() => setStep(Math.max(0, step - 1)), [step, setStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'Escape' && presentation) {
        setPresentation(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goBack, presentation, setPresentation]);

  const Current = STEPS[step];

  return (
    <div ref={topRef} className={cx('mx-auto w-full scroll-mt-4', presentation ? 'max-w-[1400px] text-[17px]' : 'max-w-6xl')}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={cx('font-semibold tracking-tight text-ink', presentation ? 'text-xl' : 'text-2xl sm:text-[28px]')}>Guided Experiment</h1>
          {!presentation && <p className="mt-1.5 text-[15px] text-ink-soft">Follow the steps to see how a wireless sensor sends and receives information.</p>}
        </div>
        {presentation ? (
          <GhostButton icon={<Minimize2 className="h-4 w-4" />} onClick={() => setPresentation(false)}>
            Exit presentation (Esc)
          </GhostButton>
        ) : (
          <SecondaryButton icon={<Maximize2 className="h-4 w-4" />} onClick={() => setPresentation(true)} title="Larger text and charts, hides navigation. Use ← and → to move between steps.">
            Presentation Mode
          </SecondaryButton>
        )}
      </div>

      <div className="mb-8 rounded-2xl border border-line bg-white px-4 py-3">
        <Stepper steps={STEP_LABELS} current={step} maxReachable={maxReachable} onSelect={setStep} />
      </div>

      <Current goNext={goNext} hint={hint} />

      <p className="mt-6 text-center text-xs text-ink-faint">Keyboard: ← Back · → Next{presentation ? ' · Esc exit presentation' : ''}</p>
    </div>
  );
}
