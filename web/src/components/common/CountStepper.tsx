import type { KeyboardEvent } from 'react';
import { stepCount } from '../../lib/countLimits';

export interface CountStepperProps {
  id?: string;
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
  helperText?: string;
  disabled?: boolean;
  unitLabel?: string;
  variant?: 'editorial' | 'rounded' | 'compact';
}

export default function CountStepper({
  id,
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
  helperText,
  disabled = false,
  unitLabel,
  variant = 'editorial',
}: CountStepperProps) {
  const safeMax = Math.max(min, max);
  const decDisabled = disabled || value <= min;
  const incDisabled = disabled || value >= safeMax;
  const lowerLabel = label.toLowerCase();

  function handleDecrement() {
    if (decDisabled) return;
    onChange(stepCount(value, -1, min, safeMax));
  }

  function handleIncrement() {
    if (incDisabled) return;
    onChange(stepCount(value, 1, min, safeMax));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(safeMax);
    }
  }

  const containerBorder =
    variant === 'rounded'
      ? 'border border-slate-200 rounded-xl bg-white'
      : variant === 'compact'
        ? 'border border-[#E8E4DC] bg-white rounded-[2px]'
        : 'border border-[#E8E4DC] bg-white rounded-[2px]';

  const btnBase =
    'min-w-[44px] min-h-[44px] w-11 h-11 inline-flex items-center justify-center text-base font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-inset';

  const btnEnabled =
    variant === 'rounded'
      ? 'text-slate-700 hover:bg-slate-50 active:bg-slate-100 cursor-pointer'
      : 'text-[#111111] hover:bg-[#F7F5F0] active:bg-[#EFECE4] cursor-pointer';

  const btnDisabledStyle = 'text-[#C2BEB6] bg-[#FAFAF8] cursor-not-allowed opacity-60';

  return (
    <div className="w-full">
      <div
        id={id}
        role="group"
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] ${containerBorder}`}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={decDisabled}
          aria-label={`Decrease ${lowerLabel}`}
          className={`${btnBase} border-r border-[#E8E4DC] ${
            decDisabled ? btnDisabledStyle : btnEnabled
          }`}
        >
          −
        </button>

        <div className="px-1.5 py-0.5 flex-1 text-center min-w-[2.75rem] overflow-hidden">
          <span
            aria-live="polite"
            aria-atomic="true"
            className="block text-sm font-semibold text-[#111111] tabular-nums leading-tight"
          >
            {value}
            {unitLabel && (
              <span className="block text-[10px] font-medium text-[#77736C] leading-tight truncate">
                {unitLabel}
              </span>
            )}
          </span>
          {sublabel && (
            <span className="block text-[11px] text-[#77736C] leading-tight truncate">
              {sublabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={incDisabled}
          aria-label={`Increase ${lowerLabel}`}
          className={`${btnBase} border-l border-[#E8E4DC] ${
            incDisabled ? btnDisabledStyle : btnEnabled
          }`}
        >
          +
        </button>
      </div>

      {helperText && (
        <p className="mt-1.5 text-[11px] text-[#77736C] leading-snug">
          {helperText}
        </p>
      )}
    </div>
  );
}

