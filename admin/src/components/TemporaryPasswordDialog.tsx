import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal.tsx';

interface TemporaryPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  temporaryPassword: string | null;
  adminEmail?: string;
}

export function TemporaryPasswordDialog({
  isOpen,
  onClose,
  temporaryPassword,
  adminEmail,
}: TemporaryPasswordDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailedNotice, setCopyFailedNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear show state and notices on open/close
  useEffect(() => {
    setShowPassword(false);
    setCopied(false);
    setCopyFailedNotice(false);

    return () => {
      // Clear on unmount
      setShowPassword(false);
      setCopied(false);
    };
  }, [isOpen]);

  const handleCopy = async () => {
    if (!temporaryPassword) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(temporaryPassword);
        setCopied(true);
        setCopyFailedNotice(false);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // Fallback below
    }

    // Fallback: select text in input for manual copy
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      inputRef.current.setSelectionRange(0, 99999);
      setCopied(true);
      setCopyFailedNotice(true);
      setTimeout(() => {
        setCopied(false);
        setCopyFailedNotice(false);
      }, 3000);
    }
  };

  const handleClose = () => {
    setShowPassword(false);
    setCopied(false);
    onClose();
  };

  if (!isOpen || !temporaryPassword) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Temporary Password"
      titleId="temp-password-title"
      closeOnBackdrop={false}
      closeOnEsc={true}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {adminEmail && (
          <p className="text-sm text-slate-600">
            A temporary password was generated for{' '}
            <span className="font-semibold text-slate-900">{adminEmail}</span>.
          </p>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs sm:text-sm font-medium leading-relaxed">
          This password is shown once. Share it securely. They must change it at first sign-in.
        </div>

        <div>
          <label
            htmlFor="temporary-password-display"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Temporary Password
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="temporary-password-display"
                type={showPassword ? 'text' : 'password'}
                readOnly
                value={temporaryPassword}
                aria-label="Temporary password"
                className="w-full font-mono text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 select-all focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className={`px-3.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {copyFailedNotice && (
            <p className="text-xs text-slate-500 mt-1" aria-live="polite">
              Text selected. Press Ctrl+C or Cmd+C to copy.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
          >
            I've saved it
          </button>
        </div>
      </div>
    </Modal>
  );
}

