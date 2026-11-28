import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  CITY_SEARCH_DEBOUNCE_MS,
  CITY_SEARCH_MIN_CHARS,
  fetchCitySuggestions,
  formatCityDisplay,
  reduceTypeaheadKeyDown,
  type CitySuggestion,
} from '../../lib/citySearch';

export interface CityTypeaheadProps {
  value: string;
  onChange: (value: string, selectedCity?: CitySuggestion) => void;
  onBlur?: () => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  containerClassName?: string;
  limit?: number;
}

export default function CityTypeahead({
  value,
  onChange,
  onBlur,
  placeholder = 'City or destination',
  id: explicitId,
  ariaLabel,
  disabled = false,
  inputClassName = '',
  inputStyle,
  containerClassName = '',
  limit = 8,
}: CityTypeaheadProps) {
  const autoId = useId();
  const inputId = explicitId || `city-typeahead-${autoId}`;
  const listboxId = `city-listbox-${autoId}`;

  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const skipNextFetchRef = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Cleanup pending timers / requests on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function cancelPending() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  function scheduleLookup(nextValue: string) {
    cancelPending();
    const trimmed = nextValue.trim();
    if (trimmed.length < CITY_SEARCH_MIN_CHARS) {
      seqRef.current++;
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const results = await fetchCitySuggestions(trimmed, {
          limit,
          signal: controller.signal,
        });
        if (seq !== seqRef.current || controller.signal.aborted) return;
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        if (seq === seqRef.current && !controller.signal.aborted) {
          setSuggestions([]);
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }
    }, CITY_SEARCH_DEBOUNCE_MS);
  }

  function handleInputChange(nextText: string) {
    skipNextFetchRef.current = false;
    onChange(nextText);
    scheduleLookup(nextText);
  }

  function handleSelect(item: CitySuggestion) {
    cancelPending();
    seqRef.current++;
    skipNextFetchRef.current = true;
    setIsOpen(false);
    setActiveIndex(-1);
    setSuggestions([]);
    onChange(item.name, item);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const transition = reduceTypeaheadKeyDown(
      { isOpen, activeIndex, itemCount: suggestions.length },
      e.key
    );

    if (transition.preventDefault) {
      e.preventDefault();
    }

    if (transition.action === 'select') {
      const chosen = suggestions[transition.activeIndex];
      if (chosen) {
        handleSelect(chosen);
      }
      return;
    }

    setIsOpen(transition.isOpen);
    setActiveIndex(transition.activeIndex);
  }

  const activeOptionId =
    isOpen && activeIndex >= 0 && activeIndex < suggestions.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-haspopup="listbox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (!skipNextFetchRef.current && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        className={inputClassName}
        style={inputStyle}
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 min-w-[260px] w-full top-full mt-1 max-h-64 overflow-y-auto bg-white border border-[#E8E4DC] shadow-xl text-sm divide-y divide-[#F7F5F0]"
          style={{ borderRadius: '2px' }}
        >
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === activeIndex;
            const displayLabel = formatCityDisplay(item);
            return (
              <li
                key={`${item.id}-${idx}`}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // Prevent input blur before selection completes
                  e.preventDefault();
                }}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors text-left ${
                  isHighlighted ? 'bg-[#F7F5F0] text-[#111111]' : 'bg-white text-[#252525] hover:bg-[#FAFAF8]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#111111] truncate">
                    {displayLabel}
                  </p>
                </div>
                {item.type === 'region' && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]">
                    State / region
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

