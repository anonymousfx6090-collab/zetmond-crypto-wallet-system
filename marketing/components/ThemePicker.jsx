'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const options = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]];

export function ThemeOptions() {
  const { theme, setTheme } = useTheme();
  return <div role="group" aria-label="Color theme" className="theme-options">{options.map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}><Icon size={15} aria-hidden="true" />{label}</button>)}</div>;
}

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const choices = useRef([]);
  const menuId = useId();
  const ActiveIcon = options.find(([value]) => value === theme)[2];

  useEffect(() => {
    if (!open) return;
    choices.current[options.findIndex(([value]) => value === theme)]?.focus();
    const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open, theme]);

  function closeAndFocus() { setOpen(false); trigger.current?.focus(); }
  function handleKeys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAndFocus(); }
    if (event.key === 'Tab') closeAndFocus();
    const current = choices.current.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (current + 1) % options.length;
    if (event.key === 'ArrowUp') next = (current + options.length - 1) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); choices.current[next]?.focus(); }
  }

  return <div ref={root} className="theme-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="theme-trigger" aria-label={`Color theme: ${theme}`} title={`Color theme: ${theme}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}><ActiveIcon size={19} aria-hidden="true" /></button>
    {open && <div id={menuId} role="menu" aria-label="Color theme" className="theme-menu" onKeyDown={handleKeys}><p className="eyebrow px-3 pt-2 pb-2 text-muted" role="presentation">APPEARANCE</p>{options.map(([value, label, Icon], index) => <button ref={element => { choices.current[index] = element; }} key={value} role="menuitemradio" aria-checked={theme === value} tabIndex={-1} type="button" onClick={() => { setTheme(value); closeAndFocus(); }}><Icon size={16} aria-hidden="true" /><span className="flex-1 text-left">{label}</span>{theme === value && <Check size={14} className="text-purple" aria-hidden="true" />}</button>)}</div>}
  </div>;
}
