import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPopoverPosition, visibleViewport } from '../utils/popoverPosition.js';

const MAX_VISIBLE_OPTIONS = 150;

const ChevronIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const normalize = (text) => String(text || '').toLowerCase();

/** Type-to-filter dropdown. `options` are `{ value, label, keywords? }`; every typed word must match. */
const SearchableSelect = ({
  id,
  name,
  value = '',
  onChange,
  options = [],
  placeholder = 'Type to search',
  emptyMessage = 'No matches found',
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
}) => {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });

  const selectedOption = options.find((item) => String(item.value) === String(value)) || null;

  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((option) => {
      const haystack = normalize(`${option.label} ${option.keywords || ''}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [options, query]);

  const visibleMatches = matches.slice(0, MAX_VISIBLE_OPTIONS);

  const updateMenuPosition = useCallback(() => {
    const field = inputRef.current;
    if (!field) return;
    setMenuStyle(getPopoverPosition(field.getBoundingClientRect(), visibleViewport(), { minWidth: 220 }));
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
  };

  const selectOption = (option) => {
    onChange?.({ target: { name, value: option.value } });
    closeMenu();
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleReposition = (event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      updateMenuPosition();
    };
    window.visualViewport?.addEventListener('resize', handleReposition);
    window.visualViewport?.addEventListener('scroll', handleReposition);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleReposition);
      window.visualViewport?.removeEventListener('scroll', handleReposition);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = query
      ? -1
      : visibleMatches.findIndex((item) => String(item.value) === String(value));
    setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector(`[data-option-index="${highlightIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const count = visibleMatches.length;
      if (!count) return;
      setHighlightIndex((prev) => (
        event.key === 'ArrowDown' ? (prev + 1) % count : (prev - 1 + count) % count
      ));
      return;
    }
    if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const option = visibleMatches[highlightIndex];
      if (option) selectOption(option);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key === 'Tab' && open) closeMenu();
  };

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      id={listId}
      role="listbox"
      className="toms-styled-select__menu"
      style={{
        position: 'fixed',
        top: menuStyle.top,
        left: menuStyle.left,
        width: menuStyle.width,
        maxHeight: menuStyle.maxHeight,
        transform: menuStyle.transform,
        // Menus are portalled to <body>; keep them above our modal overlay (1300).
        zIndex: 1400,
      }}
    >
      <div className="toms-styled-select__menu-inner">
        {visibleMatches.length === 0 && (
          <div className="toms-searchable-select__empty">{emptyMessage}</div>
        )}
        {visibleMatches.map((option, index) => {
          const isSelected = String(option.value) === String(value);
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              tabIndex={-1}
              data-option-index={index}
              aria-selected={isSelected}
              className={[
                'toms-styled-select__option',
                isSelected ? 'is-selected' : '',
                index === highlightIndex ? 'is-highlighted' : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span className="toms-styled-select__option-label">{option.label}</span>
              {isSelected && (
                <span className="toms-styled-select__option-check" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
        {matches.length > visibleMatches.length && (
          <div className="toms-searchable-select__empty">
            Showing {visibleMatches.length} of {matches.length}. Keep typing to narrow down.
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={rootRef}
      className={[
        'toms-styled-select',
        'toms-searchable-select',
        open ? 'is-open' : '',
        disabled ? 'is-disabled' : '',
      ].filter(Boolean).join(' ')}
    >
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="toms-styled-select__validator"
          value={value}
          required
          onChange={() => {}}
        />
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        className="form-control toms-searchable-select__input"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        placeholder={open && selectedOption ? selectedOption.label : placeholder}
        value={open ? query : (selectedOption?.label || '')}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="toms-searchable-select__chevron toms-styled-select__chevron" aria-hidden="true">
        <ChevronIcon />
      </span>
      {menu}
    </div>
  );
};

export default SearchableSelect;
