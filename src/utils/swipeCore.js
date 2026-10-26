// Свайп вправо от любой точки экрана возвращает назад (как в Telegram).
// Ядро без React: его можно проверять отдельно.
const COMMIT_DISTANCE = 100; // px: дотянул до порога — переход
const QUICK_DISTANCE = 40; // px: быстрый короткий «флик» тоже переход
const QUICK_TIME = 250; // мс
const SLIDE_MS = 200;

export function attachSwipeBack(el, onBack) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let direction = null; // null | 'horizontal' | 'cancel'
  let dx = 0;
  let timer = null;

  const onStart = (e) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (e.touches.length !== 1) {
      direction = 'cancel';
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    direction = null;
    dx = 0;
    el.style.transition = 'none';
  };

  const onMove = (e) => {
    if (direction === 'cancel' || e.touches.length !== 1) return;
    const x = e.touches[0].clientX - startX;
    const y = e.touches[0].clientY - startY;

    if (direction === null) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      // Вертикальный жест — это прокрутка, не возврат
      direction = x > 0 && Math.abs(x) > Math.abs(y) ? 'horizontal' : 'cancel';
    }
    if (direction !== 'horizontal') return;

    dx = Math.max(0, x);
    el.style.transform = `translateX(${dx}px)`;
  };

  const onEnd = () => {
    const was = direction;
    direction = null;
    el.style.transition = `transform ${SLIDE_MS}ms ease-out`;

    if (was !== 'horizontal') {
      el.style.transform = '';
      return;
    }
    const quick = dx > QUICK_DISTANCE && Date.now() - startTime < QUICK_TIME;
    if (dx >= COMMIT_DISTANCE || quick) {
      el.style.transform = `translateX(${window.innerWidth}px)`;
      timer = setTimeout(() => {
        timer = null;
        el.style.transition = 'none';
        el.style.transform = '';
        onBack();
      }, SLIDE_MS);
    } else {
      el.style.transform = '';
    }
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: true });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('touchcancel', onEnd);

  return () => {
    if (timer) clearTimeout(timer);
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
    el.style.transition = '';
    el.style.transform = '';
  };
}
