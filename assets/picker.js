// 시행일 선택 — <details> 는 스스로 열리고 닫힌다. 바깥을 누르거나 Esc 일 때만 닫아 준다.
(function () {
  var close = function (except) {
    document.querySelectorAll('details.picker[open]').forEach(function (d) {
      if (d !== except) d.open = false;
    });
  };
  document.addEventListener('click', function (e) {
    close(e.target.closest && e.target.closest('details.picker'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close(null);
  });
})();
