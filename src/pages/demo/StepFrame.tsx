import { ArrowLeft, ArrowRight, Lightbulb, MessageSquareText } from 'lucide-react';
import type { ReactNode } from 'react';
import { ExpandableSection, PrimaryButton, SecondaryButton, cx } from '../../components/ui';
import { useDemo } from './DemoContext';
import { PRESENTER_NOTES } from './presenterNotes';

interface Props {
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** Short contextual explanation shown beneath the interactive area. */
  context?: ReactNode;
  primaryLabel?: string;
  primaryIcon?: ReactNode;
  onPrimary?: () => void;
  /** Extra buttons placed between Back and the primary action. */
  extraActions?: ReactNode;
  hint?: string | null;
}

/** Consistent layout for every guided-demo step: heading, content, context, notes, and footer actions. */
export function StepFrame({ title, description, children, context, primaryLabel, primaryIcon, onPrimary, extraActions, hint }: Props) {
  const { step, setStep, presentation } = useDemo();
  return (
    <section aria-labelledby="step-title" className="flex flex-col">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Step {step + 1} of 6</p>
        <h2 id="step-title" className={cx('mt-1 font-semibold tracking-tight text-ink', presentation ? 'text-3xl' : 'text-2xl')}>
          {title}
        </h2>
        {(!presentation || typeof description === 'string') && (
          <p className={cx('mt-2 max-w-3xl leading-relaxed text-ink-soft', presentation ? 'text-lg' : 'text-[15px]')}>{description}</p>
        )}
      </div>

      <div className="flex-1">{children}</div>

      {context && !presentation && (
        <div className="mt-6 flex gap-2.5 rounded-xl bg-slate-100/70 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div>{context}</div>
        </div>
      )}

      <div className="mt-4">
        <ExpandableSection title="Presenter notes" icon={<MessageSquareText className="h-4 w-4 text-ink-faint" aria-hidden />}>
          {PRESENTER_NOTES[step]}
        </ExpandableSection>
      </div>

      <footer className="mt-6 border-t border-line pt-5">
        {hint && (
          <p role="alert" className="mb-3 rounded-lg bg-warn-light px-3 py-2 text-sm text-warn">
            {hint}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SecondaryButton size="lg" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Back
          </SecondaryButton>
          <div className="flex flex-wrap items-center gap-3">
            {extraActions}
            {primaryLabel && onPrimary && (
              <PrimaryButton size="lg" onClick={onPrimary}>
                {primaryLabel}
                {primaryIcon ?? <ArrowRight className="h-4 w-4" />}
              </PrimaryButton>
            )}
          </div>
        </div>
      </footer>
    </section>
  );
}
