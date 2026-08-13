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
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

const buildDisplayLabel = (selectedValues, allOptions, placeholder) => {
  if (!selectedValues.length) return placeholder;
  if (selectedValues.length === 1) {
    const match = allOptions.find((item) => String(item.value) === String(selectedValues[0]));
    return match?.label || placeholder;
  }
  return `${selectedValues.length} selected`;
};

const StyledMultiSelect = ({
  id,
  name,
  value = [],
  onChange,
  options = [],
  groups = [],
  placeholder = 'Select options',
  disabled = false,
  size,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const listId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  const selectedValues = Array.isArray(value) ? value.map(String) : [];
  const allOptions = flattenOptions(options, groups);
  const displayLabel = buildDisplayLabel(selectedValues, allOptions, placeholder);
  const isPlaceholder = selectedValues.length === 0;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const preferredMax = 320;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(preferredMax, openUp ? spaceAbove - gap : spaceBelow - gap));

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
  }, []);

  const emitChange = useCallback((nextValues) => {
    if (disabled) return;
    onChange?.({
      target: {
        name,
        value: nextValues,
        selectedOptions: nextValues.map((entry) => ({ value: entry })),
      },
    });
  }, [disabled, name, onChange]);

  const toggleValue = useCallback((optionValue) => {
    const key = String(optionValue);
    const nextValues = selectedValues.includes(key)
      ? selectedValues.filter((entry) => entry !== key)
      : [...selectedValues, key];
    emitChange(nextValues);
  }, [emitChange, selectedValues]);

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

  const renderOption = (option) => {
    const isSelected = selectedValues.includes(String(option.value));

    return (
      <button
        key={`${option.value}-${option.label}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        className={[
          'toms-styled-multi-select__option',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ')}
        disabled={option.disabled}
        onClick={() => toggleValue(option.value)}
      >
        <span className="toms-styled-multi-select__option-box" aria-hidden="true">
          {isSelected && <CheckIcon />}
        </span>
        <span className="toms-styled-multi-select__option-label">{option.label}</span>
      </button>
    );
  };

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      id={listId}
      role="listbox"
      aria-multiselectable="true"
      className="toms-styled-multi-select__menu"
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
      <div className="toms-styled-multi-select__menu-inner">
        {options.map((option) => renderOption(option))}
        {groups.map((group) => (
          <div key={group.label} className="toms-styled-multi-select__group" role="presentation">
            <div className="toms-styled-multi-select__group-label">{group.label}</div>
            {(group.options || []).map((option) => renderOption(option))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={rootRef}
      className={[
        'toms-styled-multi-select',
        size === 'sm' ? 'toms-styled-multi-select--sm' : '',
        open ? 'is-open' : '',
        disabled ? 'is-disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="toms-styled-multi-select__trigger form-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className={['toms-styled-multi-select__value', isPlaceholder ? 'is-placeholder' : ''].filter(Boolean).join(' ')}>
          {displayLabel}
        </span>
        <span className="toms-styled-multi-select__chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {menu}
    </div>
  );
};

export default StyledMultiSelect;
