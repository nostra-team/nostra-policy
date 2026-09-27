// 시행일 선택 — <details> 는 스스로 열리고 닫힌다. 바깥을 누르거나 Esc 일 때만 닫아 준다.
(() => {
  const close = (except: Element | null): void => {
    document.querySelectorAll<HTMLDetailsElement>('details.picker[open]').forEach((d) => {
      if (d !== except) d.open = false;
    });
  };
  document.addEventListener('click', (e) => {
    close(e.target instanceof Element ? e.target.closest('details.picker') : null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(null);
  });
})();
