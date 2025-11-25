/* ===========================
   Kalkulator Interaktif - Script
   Features:
   - Shunting-yard to RPN conversion (operator precedence)
   - RPN evaluation
   - Proper handling of CE/C, decimal, chained expressions
   - History (max 5), Memory (M+, M-, MR, MC)
   - Keyboard support
   - Robust input handling (no eval)
   =========================== */

/* ====== DOM elements ====== */
const expressionEl = document.getElementById('expression');
const valueEl = document.getElementById('value');
const historyEl = document.getElementById('history');
const memIndicator = document.getElementById('mem-indicator');
const memoryEl = document.getElementById('memory');

/* ====== State ====== */
let currentInput = '';    // the number user is currently typing as string
let exprTokens = [];      // tokens that form the current expression (numbers & ops)
let history = [];         // array of strings (most recent first)
let memory = 0;           // memory register

/* ====== Utilities ====== */
function updateScreen() {
  // build expression preview
  const exprPreview = exprTokens.join(' ');
  expressionEl.textContent = exprPreview || '\u00A0'; // non-breaking space when empty
  valueEl.textContent = currentInput === '' ? '0' : currentInput;
  memIndicator.textContent = `M: ${memory}`;
  memoryEl.textContent = `Memory: ${memory}`;
}

function pushHistory(entry) {
  history.unshift(entry);
  if (history.length > 5) history.pop();
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = '';
  if (history.length === 0) {
    historyEl.innerHTML = `<div style="color:#6b7280;padding:6px;">No history</div>`;
    return;
  }
  history.forEach(item => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.textContent = item;
    historyEl.appendChild(d);
  });
}

/* ====== Parsing & Evaluator (shunting-yard + RPN) ====== */
const OPS = {
  '+': {prec: 1, assoc: 'L'},
  '-': {prec: 1, assoc: 'L'},
  '*': {prec: 2, assoc: 'L'},
  '/': {prec: 2, assoc: 'L'}
};

function isNumberToken(t) {
  return t !== undefined && t !== null && t !== '' && !isNaN(Number(t));
}

/**
 * Convert tokens to RPN using shunting-yard.
 * tokens: array like ['12', '+', '3', '*', '4']
 */
function toRPN(tokens) {
  const output = [];
  const opsStack = [];
  for (const tok of tokens) {
    if (isNumberToken(tok)) {
      output.push(tok);
    } else if (tok in OPS) {
      while (opsStack.length > 0) {
        const top = opsStack[opsStack.length - 1];
        if (top in OPS &&
           ((OPS[tok].assoc === 'L' && OPS[tok].prec <= OPS[top].prec) ||
            (OPS[tok].assoc === 'R' && OPS[tok].prec < OPS[top].prec))) {
          output.push(opsStack.pop());
        } else break;
      }
      opsStack.push(tok);
    } else {
      // unknown token: ignore
    }
  }
  while (opsStack.length) output.push(opsStack.pop());
  return output;
}

function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (isNumberToken(t)) {
      st.push(Number(t));
    } else if (t in OPS) {
      if (st.length < 2) throw new Error('Malformed expression');
      const b = st.pop();
      const a = st.pop();
      let res = 0;
      switch (t) {
        case '+': res = a + b; break;
        case '-': res = a - b; break;
        case '*': res = a * b; break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          res = a / b; break;
      }
      // avoid floating point mess by rounding sensibly
      if (!Number.isInteger(res)) {
        res = parseFloat(res.toFixed(12)); // keep enough precision
      }
      st.push(res);
    } else {
      throw new Error('Unknown operator ' + t);
    }
  }
  if (st.length !== 1) throw new Error('Malformed expression (end stack)');
  return st[0];
}

/* ====== Core actions ====== */
function pressNumber(digit) {
  // prevent leading zeros like "0003"
  if (currentInput === '0') currentInput = String(digit);
  else currentInput = currentInput + String(digit);
  updateScreen();
}

function pressDecimal() {
  if (currentInput.includes('.')) return;
  if (currentInput === '') currentInput = '0.';
  else currentInput += '.';
  updateScreen();
}

function pressOperator(op) {
  // if user hasn't typed number but there is expression and last token is operator,
  // allow replacing the last operator (user change of mind)
  if (currentInput === '' && exprTokens.length > 0) {
    const last = exprTokens[exprTokens.length - 1];
    if (last in OPS) {
      exprTokens[exprTokens.length - 1] = op;
      updateScreen();
      return;
    }
  }

  // if there's a current input, push it
  if (currentInput !== '') {
    exprTokens.push(currentInput);
    currentInput = '';
  }

  // don't push operator at start
  if (exprTokens.length === 0) {
    // allow unary minus? For simplicity, ignore (user must type 0 - x)
    return;
  }

  // if last is operator, replace
  const last = exprTokens[exprTokens.length - 1];
  if (last in OPS) exprTokens[exprTokens.length - 1] = op;
  else exprTokens.push(op);

  updateScreen();
}

function calculate() {
  // if there's current input, include it
  if (currentInput !== '') exprTokens.push(currentInput);

  // nothing to compute
  if (exprTokens.length === 0) {
    currentInput = '';
    updateScreen();
    return;
  }

  // ensure expression doesn't end with operator
  const last = exprTokens[exprTokens.length - 1];
  if (last in OPS) {
    // remove trailing operator
    exprTokens.pop();
  }

  try {
    const rpn = toRPN(exprTokens);
    const result = evalRPN(rpn);

    // push to history: show in natural readable form
    const prettyExpr = exprTokens.join(' ');
    pushHistory(`${prettyExpr} = ${result}`);

    // set currentInput to result so user can continue chaining
    currentInput = String(result);
    exprTokens = []; // reset expression
    updateScreen();
  } catch (err) {
    // display error
    currentInput = '';
    exprTokens = [];
    valueEl.textContent = 'Error';
    expressionEl.textContent = '\u00A0';
    console.warn('Calc error:', err);
  }
}

/* ====== Clear functions ====== */
function clearAll() { // C
  currentInput = '';
  exprTokens = [];
  updateScreen();
}

function clearEntry() { // CE
  currentInput = '';
  updateScreen();
}

/* ====== Memory functions ====== */
function memoryClear() { memory = 0; memoryEl.textContent = `Memory: ${memory}`; memIndicator.textContent = `M: ${memory}`; }
function memoryRecall() { if (memory !== 0) { currentInput = String(memory); updateScreen(); } else { currentInput = '0'; updateScreen(); } }
function memoryPlus() { const v = Number(valueEl.textContent || 0); memory = Number((memory + v).toFixed(12)); memoryEl.textContent = `Memory: ${memory}`; memIndicator.textContent = `M: ${memory}`; }
function memoryMinus() { const v = Number(valueEl.textContent || 0); memory = Number((memory - v).toFixed(12)); memoryEl.textContent = `Memory: ${memory}`; memIndicator.textContent = `M: ${memory}`; }

/* ====== Hook buttons and keyboard ====== */
function setupButtons() {
  const buttons = document.querySelectorAll('[data-num], [data-op], [data-action]');
  buttons.forEach(btn => {
    // use pointerdown for better feel on touch
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // prevent focus weirdness
      btn.classList.add('pressed');
    });
    btn.addEventListener('pointerup', (e) => {
      btn.classList.remove('pressed');
    });
    btn.addEventListener('click', (e) => {
      const num = btn.getAttribute('data-num');
      const op = btn.getAttribute('data-op');
      const action = btn.getAttribute('data-action');

      if (num !== null) {
        pressNumber(num);
      } else if (op !== null) {
        pressOperator(op);
      } else if (action !== null) {
        handleAction(action);
      }
    });
  });

  // memory buttons
  document.getElementById('mc').addEventListener('click', memoryClear);
  document.getElementById('mr').addEventListener('click', memoryRecall);
  document.getElementById('mplus').addEventListener('click', memoryPlus);
  document.getElementById('mminus').addEventListener('click', memoryMinus);
}

function handleAction(action) {
  switch (action) {
    case 'C': clearAll(); break;
    case 'CE': clearEntry(); break;
    case '.': pressDecimal(); break;
    case '=': calculate(); break;
    default:
      if (action === '.') pressDecimal();
  }
}

/* ====== Keyboard support ====== */
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/^[0-9]$/.test(key)) {
      pressNumber(key);
      e.preventDefault();
      return;
    }
    if (key === '.' || key === ',') {
      pressDecimal(); e.preventDefault(); return;
    }
    if (['+','-','*','/'].includes(key)) {
      pressOperator(key); e.preventDefault(); return;
    }
    if (key === 'Enter' || key === '=') {
      calculate(); e.preventDefault(); return;
    }
    if (key === 'Backspace') {
      // Backspace behaves like CE (clear current entry)
      clearEntry(); e.preventDefault(); return;
    }
    if (key === 'Escape') {
      clearAll(); e.preventDefault(); return;
    }
    // Memory shortcuts (optional): M to recall, Shift+M to memory plus
    if (key.toLowerCase() === 'm') {
      memoryRecall(); e.preventDefault(); return;
    }
  });
}

/* ====== Init ====== */
(function init() {
  setupButtons();
  setupKeyboard();
  renderHistory();
  updateScreen();
})();

/* ====== Accessibility: allow clicking history to reuse expression ====== */
historyEl.addEventListener('click', (e) => {
  const item = e.target.closest('.history-item');
  if (!item) return;
  // parse "a op b op c = result", we take the left side
  const text = item.textContent.split(' = ')[0];
  // split by space to tokens and apply as current expression
  const tokens = text.split(' ').filter(s => s.trim() !== '');
  exprTokens = tokens.slice(); // copy tokens
  currentInput = '';
  updateScreen();
});
