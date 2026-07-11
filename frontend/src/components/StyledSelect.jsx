import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ChevronIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M5 7.5 10 12.5 15 7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3.5 8.5 6.5 11.5 12.5 4.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const flattenOptions = (options = [], groups = []) => {
  const flat = [...options];
  groups.forEach((group) => {
    flat.push(...(group.options || []));
  });
  return flat;
};

const StyledSelect = ({
  id,
  name,
  value = '',
  onChange,
  options = [],
  groups = [],
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const listId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const shouldScrollHighlightRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  const allOptions = flattenOptions(options, groups);
  const optionsKey = allOptions.map((item) => `${item.value}:${item.label}:${item.disabled ? 1 : 0}`).join('|');
  const selectedOption = allOptions.find((item) => String(item.value) === String(value));
  const displayLabel = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  const enabledOptions = allOptions.filter((item) => !item.disabled);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const preferredMax = 280;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(preferredMax, openUp ? spaceAbove - gap : spaceBelow - gap));

    setMenuStyle({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
      transform: openUp ? 'translateY(-100%)' : 'none',
    });
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setHighlightIndex(-1);
  }, []);

  const selectValue = useCallback((nextValue) => {
    if (disabled) return;
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    });
    closeMenu();
    triggerRef.current?.focus();
  }, [closeMenu, disabled, name, onChange]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();

    const handleReposition = (event) => {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      updateMenuPosition();
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const root = rootRef.current;
      const menu = menuRef.current;
      if (root?.contains(event.target) || menu?.contains(event.target)) return;
      closeMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = enabledOptions.findIndex((item) => String(item.value) === String(value));
    setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, optionsKey, value]);

  useEffect(() => {
    if (!open || highlightIndex < 0 || !shouldScrollHighlightRef.current) return;
    shouldScrollHighlightRef.current = false;
    const optionEl = menuRef.current?.querySelector(`[data-option-index="${highlightIndex}"]`);
    optionEl?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((prev) => {
        const next = prev < enabledOptions.length - 1 ? prev + 1 : 0;
        return next;
      });
      shouldScrollHighlightRef.current = true;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : enabledOptions.length - 1;
        return next;
      });
      shouldScrollHighlightRef.current = true;
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const option = enabledOptions[highlightIndex];
      if (option) selectValue(option.value);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    }
  };

  const renderOption = (option, optionIndex) => {
    const isSelected = String(option.value) === String(value);
    const isHighlighted = enabledOptions[highlightIndex]?.value === option.value;

    return (
      <button
        key={`${option.value}-${option.label}`}
        type="button"
        role="option"
        data-option-index={optionIndex}
        aria-selected={isSelected}
        className={[
          'toms-styled-select__option',
          isSelected ? 'is-selected' : '',
          isHighlighted ? 'is-highlighted' : '',
        ].filter(Boolean).join(' ')}
        disabled={option.disabled}
        onMouseEnter={() => setHighlightIndex(optionIndex)}
        onClick={() => selectValue(option.value)}
      >
        <span className="toms-styled-select__option-label">{option.label}</span>
        {isSelected && (
          <span className="toms-styled-select__option-check" aria-hidden="true">
            <CheckIcon />
          </span>
        )}
      </button>
    );
  };

  let enabledIndex = 0;

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
        zIndex: 1200,
      }}
    >
      <div className="toms-styled-select__menu-inner">
        {options.map((option) => {
          const currentIndex = option.disabled ? -1 : enabledIndex;
          if (!option.disabled) enabledIndex += 1;
          return renderOption(option, currentIndex);
        })}
        {groups.map((group) => (
          <div key={group.label} className="toms-styled-select__group" role="presentation">
            <div className="toms-styled-select__group-label">{group.label}</div>
            {(group.options || []).map((option) => {
              const currentIndex = option.disabled ? -1 : enabledIndex;
              if (!option.disabled) enabledIndex += 1;
              return renderOption(option, currentIndex);
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={rootRef}
      className={['toms-styled-select', open ? 'is-open' : '', disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ')}
    >
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="toms-styled-select__validator"
          value={value}
          required={required}
          onChange={() => {}}
        />
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="toms-styled-select__trigger form-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={['toms-styled-select__value', isPlaceholder ? 'is-placeholder' : ''].filter(Boolean).join(' ')}>
          {displayLabel}
        </span>
        <span className="toms-styled-select__chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {menu}
    </div>
  );
};

export default StyledSelect;
