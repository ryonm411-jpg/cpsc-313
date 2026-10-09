/* quiz.js — declarative quizzes with instant feedback.
 *
 * Single answer:   <div class="quiz" data-answer="2"> <p class="q">…</p>
 *                    <ol class="opts"><li>…</li>…</ol> <div class="why">…</div> </div>
 *                  (data-answer is the 0-based index of the right option)
 * Multi-select:    same, with data-answer="0,3" — adds a "Check" button.
 * Numeric:         <div class="quiz numeric" data-answer="28"> <p class="q">…</p> <div class="why">…</div></div>
 *
 * Quiz.mount(root) wires up every .quiz under root (called automatically on load).
 */
(function (root) {
  'use strict';

  function verdict(box, ok) {
    var v = box.querySelector('.verdict');
    if (!v) {
      v = document.createElement('p');
      var why = box.querySelector('.why');
      if (why) why.insertBefore(v, why.firstChild); else box.appendChild(v);
    }
    v.className = 'verdict ' + (ok ? 'ok' : 'no');
    v.textContent = ok ? 'Correct.' : 'Not quite — read why, then try the next one from memory.';
    box.classList.add('done');
  }

  function mountChoice(box) {
    var answers = box.dataset.answer.split(',').map(Number);
    var multi = answers.length > 1 || box.hasAttribute('data-multi');
    var buttons = [];
    box.querySelectorAll('.opts > li').forEach(function (li, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = li.innerHTML;
      li.innerHTML = '';
      li.appendChild(b);
      buttons.push(b);
      b.addEventListener('click', function () {
        if (box.classList.contains('done')) return;
        if (multi) { b.classList.toggle('picked'); return; }
        reveal([i]);
      });
    });
    function reveal(picked) {
      buttons.forEach(function (b, i) {
        b.classList.remove('picked');
        if (answers.indexOf(i) >= 0) b.classList.add('right');
        else if (picked.indexOf(i) >= 0) b.classList.add('wrong');
      });
      var ok = picked.length === answers.length && picked.every(function (p) { return answers.indexOf(p) >= 0; });
      verdict(box, ok);
    }
    if (multi) {
      var check = document.createElement('button');
      check.type = 'button'; check.className = 'btn'; check.textContent = 'Check';
      check.style.marginTop = '.6rem';
      check.addEventListener('click', function () {
        if (box.classList.contains('done')) return;
        var picked = [];
        buttons.forEach(function (b, i) { if (b.classList.contains('picked')) picked.push(i); });
        reveal(picked);
      });
      box.querySelector('.opts').after(check);
    }
  }

  function mountNumeric(box) {
    var row = document.createElement('div');
    row.className = 'row';
    var input = document.createElement('input');
    input.type = 'number';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Check';
    row.appendChild(input); row.appendChild(btn);
    var why = box.querySelector('.why');
    box.insertBefore(row, why);
    function go() {
      if (input.value === '') return;
      verdict(box, Number(input.value) === Number(box.dataset.answer));
      input.disabled = true; btn.disabled = true;
    }
    btn.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function mount(scope) {
    (scope || document).querySelectorAll('.quiz:not([data-mounted]):not(.drill)').forEach(function (box) {
      box.setAttribute('data-mounted', '');
      if (box.classList.contains('numeric')) mountNumeric(box); else mountChoice(box);
    });
  }

  root.Quiz = { mount: mount, verdict: verdict };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
  else mount();
})(window);
