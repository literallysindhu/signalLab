import { cx } from './ui';

interface Props {
  bits: Uint8Array;
  /** Reference bits; positions that differ are highlighted. */
  compareTo?: Uint8Array;
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** Number of bits shown as "already processed" (others are dimmed). */
  revealed?: number;
  label: string;
}

/** Bit sequence grouped in bytes. Optional click-to-inspect and error highlighting. */
export function BitStrip({ bits, compareTo, selected, onSelect, revealed, label }: Props) {
  const bytes = Math.ceil(bits.length / 8);
  return (
    <div aria-label={label} className="flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-[13px] leading-none">
      {Array.from({ length: bytes }, (_, byte) => (
        <span key={byte} className="inline-flex">
          {Array.from(bits.slice(byte * 8, byte * 8 + 8), (b, j) => {
            const i = byte * 8 + j;
            const err = compareTo !== undefined && compareTo[i] !== b;
            const dim = revealed !== undefined && i >= revealed;
            const cls = cx(
              'inline-flex h-6 w-[18px] items-center justify-center rounded',
              err ? 'bg-bad-light font-bold text-bad' : 'text-ink',
              dim && 'text-slate-300',
              selected === i && 'ring-2 ring-amber-400',
              onSelect && 'cursor-pointer hover:bg-slate-100',
            );
            return onSelect ? (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => onSelect(i)}
                aria-label={`Bit ${i}: ${b}${err ? ' (error)' : ''}`}
                aria-pressed={selected === i}
              >
                {b}
              </button>
            ) : (
              <span key={i} className={cls}>
                {b}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
