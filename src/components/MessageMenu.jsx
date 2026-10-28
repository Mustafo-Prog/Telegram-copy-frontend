import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const ICONS = {
  reply: 'M10 5 3 11l7 6v-4c6 0 8 2 11 6-1-8-4-10-11-10z',
  readers: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  save: 'M6 3h12v18l-6-4-6 4z',
  copy: 'M9 9h10v12H9z M5 3h10v3H8v9H5z',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  select: 'M5 12l4 4 10-10',
  delete: 'M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12',
};

// Контекстное меню сообщения. Открывается у точки нажатия и не выходит за экран.
export default function MessageMenu({ x, y, items, onSelect, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, x), window.innerWidth - width - margin);
    const fitsBelow = y + height + margin <= window.innerHeight;
    const top = fitsBelow ? y : Math.max(margin, y - height);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="msg-menu" style={{ left: pos.left, top: pos.top }} role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`msg-menu__item${item.danger ? ' msg-menu__item--danger' : ''}`}
          onClick={() => onSelect(item.key)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={ICONS[item.key]} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
