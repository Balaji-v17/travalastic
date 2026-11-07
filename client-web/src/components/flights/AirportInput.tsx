import { useState, useEffect, useRef, useId, type KeyboardEvent } from 'react';
import { suggestAirports, type AirportSuggestion } from '../../lib/flightsApi';
import { createStaleGuard } from '../../lib/searchState';

export function formatAirportDisplay(item: AirportSuggestion): string {
  const city = item.cityName || item.name;
  return `${city} (${item.iataCode}) · ${item.name}`;
}

export interface AirportInputProps {
  label: string;
  value: string | null; // Confirmed 3-letter IATA code
  onChange: (iataCode: string | null, suggestion?: AirportSuggestion) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  initialText?: string;
  className?: string;
}

export default function AirportInput({
  label,
  value,
  onChange,
  placeholder = 'City or airport (e.g. London, BOM)',
  id: explicitId,
  disabled = false,
  initialText = '',
  className = '',
}: AirportInputProps) {
  const autoId = useId();
  const inputId = explicitId || `airport-input-${autoId}`;
  const listboxId = `airport-listbox-${autoId}`;

  const [inputText, setInputText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<AirportSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const staleGuardRef = useRef(createStaleGuard());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync if initialText changes from parent
  useEffect(() => {
    if (initialText && !inputText) {
      setInputText(initialText);
    }
  }, [initialText]);

  // Handle outside click to close listbox
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setIsOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const queryId = staleGuardRef.current.start();
    setLoading(true);

    suggestAirports({ q: trimmed, signal: controller.signal })
      .then((results) => {
        if (staleGuardRef.current.isCurrent(queryId)) {
          setSuggestions(results || []);
          setIsOpen(true);
          setHighlightedIndex(results && results.length > 0 ? 0 : -1);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && staleGuardRef.current.isCurrent(queryId)) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (staleGuardRef.current.isCurrent(queryId)) {
          setLoading(false);
        }
      });
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    // User is typing -> clear confirmed IATA code
    onChange(null);
    setHighlightedIndex(-1);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const timer = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);

    return () => clearTimeout(timer);
  };

  const handleSelect = (item: AirportSuggestion) => {
    const display = formatAirportDisplay(item);
    setInputText(display);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    onChange(item.iataCode, item);
  };

  const handleClear = () => {
    setInputText('');
    onChange(null);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    staleGuardRef.current.cancel();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const activeDescendantId =
    isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  const showUnconfirmedHint = !value && inputText.trim().length >= 2 && !loading;

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={inputId} className="text-xs font-semibold tracking-wider uppercase text-[#77736C]">
          {label}
        </label>
        {value ? (
          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F7F5F0] text-[#111111] border border-[#E8E4DC]">
            {value}
          </span>
        ) : showUnconfirmedHint ? (
          <span className="text-[11px] text-[#C9A96E] font-medium animate-fade-in">
            Pick an airport from the list
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-haspopup="listbox"
          disabled={disabled}
          value={inputText}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
            else if (inputText.trim().length >= 2) fetchSuggestions(inputText);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full px-3.5 py-2.5 bg-white border text-sm text-[#111111] placeholder:text-[#A8A49C] transition-all outline-none ${
            value
              ? 'border-[#111111] bg-[#FAFAF8]'
              : 'border-[#E8E4DC] focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E]'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-[#F7F5F0]' : ''}`}
          style={{ borderRadius: '2px' }}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-[#E8E4DC] border-t-[#C9A96E] rounded-full animate-spin" />
          )}
          {inputText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear ${label}`}
              className="p-1 text-[#77736C] hover:text-[#111111] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white border border-[#E8E4DC] shadow-lg text-sm divide-y divide-[#F7F5F0]"
          style={{ borderRadius: '2px' }}
        >
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-xs text-[#77736C] text-center">
              {loading ? 'Searching airports via Duffel…' : 'No matching airports found'}
            </li>
          ) : (
            suggestions.map((item, idx) => {
              const isSelected = value === item.iataCode;
              const isHighlighted = highlightedIndex === idx;
              return (
                <li
                  key={`${item.iataCode}-${idx}`}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-[#F7F5F0] text-[#111111]' : 'text-[#252525]'
                  } ${isSelected ? 'font-semibold text-[#111111]' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {item.cityName || item.name}{' '}
                      <span className="font-mono text-xs font-bold text-[#C9A96E]">
                        ({item.iataCode})
                      </span>
                    </span>
                    <span className="text-xs text-[#77736C] truncate max-w-[280px]">
                      {item.name} {item.country ? `· ${item.country}` : ''}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-xs text-[#111111] font-bold">✓</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

