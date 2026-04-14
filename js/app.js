/**
 * app.js
 * Main application controller.
 * Wires up UI events, grammar parsing, CFG parsing, and rendering.
 */

document.addEventListener("DOMContentLoaded", () => {

  // ── DOM References ──────────────────────────────────────────────────────
  const grammarInput   = document.getElementById("grammar-input");
  const stringInput    = document.getElementById("string-input");
  const startSymInput  = document.getElementById("start-symbol");
  const ambiguityCheck = document.getElementById("ambiguity-check");
  const parseBtn       = document.getElementById("parse-btn");
  const clearBtn       = document.getElementById("clear-btn");
  const errorBox      = document.getElementById("error-box");
  const mainAmbiguityStatus = document.getElementById("main-ambiguity-status");

  const treeCanvas    = document.getElementById("tree-canvas");
  const canvasWrapper = document.getElementById("canvas-wrapper");
  const treePlaceholder = document.getElementById("tree-placeholder");

  const tabs          = document.querySelectorAll(".tab");
  const tabContents   = document.querySelectorAll(".tab-content");

  const zoomInBtn     = document.getElementById("zoom-in");
  const zoomOutBtn    = document.getElementById("zoom-out");
  const zoomResetBtn  = document.getElementById("zoom-reset");
  const zoomLabel     = document.getElementById("zoom-label");

  const stepPrevBtn   = document.getElementById("step-prev");
  const stepToggleBtn = document.getElementById("step-toggle");
  const stepNextBtn   = document.getElementById("step-next");
  const stepLabel     = document.getElementById("step-label");
  const treePrevBtn   = document.getElementById("tree-prev");
  const treeNextBtn   = document.getElementById("tree-next");
  const treeLabel     = document.getElementById("tree-label");

  const derivationSteps = document.getElementById("derivation-steps");
  const grammarInfoEl   = document.getElementById("grammar-info-content");

  const presetBtns    = document.querySelectorAll(".preset-btn");

  // ── State ───────────────────────────────────────────────────────────────
  const grammar  = new Grammar();
  let   renderer = null;
  let   parseResults = [];
  let   currentParseIndex = 0;
  let   leftmostResults = null;
  let   rightmostResults = null;

  // ── Init Canvas ─────────────────────────────────────────────────────────
  function initCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    treeCanvas.width  = rect.width  || 800;
    treeCanvas.height = rect.height || 500;
    renderer = new TreeRenderer(treeCanvas);
    renderer.onStepChange = step => {
      stepLabel.textContent = `Step: ${step}`;
    };
  }

  initCanvas();

  window.addEventListener("resize", () => {
    const rect = canvasWrapper.getBoundingClientRect();
    if (renderer) renderer.resize(rect.width, rect.height);
  });

  function updateTreeNavigation() {
    const total = parseResults.length;
    treeLabel.textContent = total > 0 ? `Parse ${currentParseIndex + 1}/${total}` : `Parse 0/0`;
    treePrevBtn.disabled = currentParseIndex <= 0;
    treeNextBtn.disabled = currentParseIndex >= total - 1;
  }

  function renderParseResult(index) {
    if (!parseResults.length || index < 0 || index >= parseResults.length) return;
    currentParseIndex = index;
    const result = parseResults[index];
    renderer.render(result.tree, { animate: true, interval: 360 });
    stepLabel.textContent = `Step: ${renderer.getCurrentStep()}`;
    updateTreeNavigation();
  }

  function updateMainAmbiguityStatus(resultCount) {
    if (resultCount === 0) {
      mainAmbiguityStatus.textContent = 'Generate a parse tree to see whether the string is ambiguous.';
      mainAmbiguityStatus.className = 'ambiguity-status info';
    } else if (resultCount === 1) {
      mainAmbiguityStatus.textContent = 'This string is unambiguous for the selected derivation strategy.';
      mainAmbiguityStatus.className = 'ambiguity-status success';
    } else {
      mainAmbiguityStatus.textContent = `This string is ambiguous; ${resultCount} parses were found for the selected strategy.`;
      mainAmbiguityStatus.className = 'ambiguity-status error';
    }
  }

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");

      if (tab.dataset.tab === "tree" && renderer) {
        const rect = canvasWrapper.getBoundingClientRect();
        renderer.resize(rect.width, rect.height);
      }
    });
  });

  // ── Zoom Controls ───────────────────────────────────────────────────────
  zoomInBtn.addEventListener("click",    () => { zoomLabel.textContent = renderer.zoom(1.2) + "%"; });
  zoomOutBtn.addEventListener("click",   () => { zoomLabel.textContent = renderer.zoom(0.83) + "%"; });
  zoomResetBtn.addEventListener("click", () => { zoomLabel.textContent = renderer.resetZoom() + "%"; });

  // ── Step Controls ───────────────────────────────────────────────────────
  stepPrevBtn.addEventListener("click", () => {
    if (renderer) {
      renderer.pause();
      stepToggleBtn.textContent = "▶";
      stepToggleBtn.title = "Resume animation";
      renderer.stepBackward();
      stepLabel.textContent = `Step: ${renderer.getCurrentStep()}`;
    }
  });
  stepNextBtn.addEventListener("click", () => {
    if (renderer) {
      renderer.pause();
      stepToggleBtn.textContent = "▶";
      stepToggleBtn.title = "Resume animation";
      renderer.stepForward();
      stepLabel.textContent = `Step: ${renderer.getCurrentStep()}`;
    }
  });
  stepToggleBtn.addEventListener("click", () => {
    if (!renderer) return;
    if (renderer.isPlaying()) {
      renderer.pause();
      stepToggleBtn.textContent = "▶";
      stepToggleBtn.title = "Resume animation";
    } else {
      renderer.play();
      stepToggleBtn.textContent = "❚❚";
      stepToggleBtn.title = "Pause animation";
    }
  });
  treePrevBtn.addEventListener("click", () => {
    if (!parseResults.length) return;
    renderer.pause();
    stepToggleBtn.textContent = "▶";
    stepToggleBtn.title = "Resume animation";
    renderParseResult(Math.max(0, currentParseIndex - 1));
  });
  treeNextBtn.addEventListener("click", () => {
    if (!parseResults.length) return;
    renderer.pause();
    stepToggleBtn.textContent = "▶";
    stepToggleBtn.title = "Resume animation";
    renderParseResult(Math.min(parseResults.length - 1, currentParseIndex + 1));
  });

  // ── Presets ─────────────────────────────────────────────────────────────
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const p = PRESETS[btn.dataset.preset];
      if (!p) return;
      grammarInput.value  = p.grammar;
      stringInput.value   = p.string;
      startSymInput.value = p.start;
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // ── Clear ────────────────────────────────────────────────────────────────
  clearBtn.addEventListener("click", () => {
    grammarInput.value  = "";
    stringInput.value   = "";
    startSymInput.value = "S";
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    if (renderer) renderer.clear();
    treePlaceholder.style.display = "flex";
    derivationSteps.innerHTML = `<div class="placeholder"><div class="placeholder-icon">📜</div><p>Derivation steps will appear here</p></div>`;
    grammarInfoEl.innerHTML   = `<div class="placeholder"><div class="placeholder-icon">ℹ️</div><p>Grammar analysis will appear here</p></div>`;
    parseResults = [];
    currentParseIndex = 0;
    treeLabel.textContent = "Parse 0/0";
    updateMainAmbiguityStatus(0);
    stepLabel.textContent = "Step: 0";
    stepToggleBtn.textContent = "▶";
    stepToggleBtn.title = "Resume animation";
    presetBtns.forEach(b => b.classList.remove("active"));
  });

  // ── Parse ────────────────────────────────────────────────────────────────
  parseBtn.addEventListener("click", runParse);
  stringInput.addEventListener("keydown", e => { if (e.key === "Enter") runParse(); });

  function runParse() {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";

    const grammarText = grammarInput.value.trim();
    const inputStr    = stringInput.value.trim();
    const startSym    = startSymInput.value.trim() || "S";
    const strategy      = document.querySelector('input[name="strategy"]:checked').value;
    const checkAmbiguity = ambiguityCheck.checked;

    if (!grammarText) {
      showError("Please enter grammar rules.");
      return;
    }

    // Parse grammar
    grammar.parse(grammarText, startSym);

    if (!grammar.isValid()) {
      showError(grammar.getErrors().join("\n"));
      if (renderer) renderer.clear();
      treePlaceholder.style.display = "flex";
      return;
    }

    // Compute grammar summary and ambiguity info
    const summary = grammar.getSummary();
    summary.ambiguity = checkAmbiguity
      ? grammar.checkAmbiguity({ maxDepth: 8, maxStates: 4000 })
      : { checked: false, reason: "Not checked" };

    renderGrammarInfo(summary);

    // Parse the string for both derivation strategies
    const parser = new CFGParser(grammar);
    const mainResult = parser.parseAll(inputStr, strategy);
    const otherResult = parser.parseAll(inputStr, strategy === 'leftmost' ? 'rightmost' : 'leftmost');

    if (!mainResult.success) {
      showError(mainResult.error);
      if (renderer) renderer.clear();
      treePlaceholder.style.display = "flex";
      updateMainAmbiguityStatus(0);
      return;
    }

    leftmostResults = strategy === 'leftmost' ? mainResult : otherResult;
    rightmostResults = strategy === 'rightmost' ? mainResult : otherResult;
    parseResults = mainResult.results;
    currentParseIndex = 0;

    // Main ambiguity indicator for the parsed string
    updateMainAmbiguityStatus(parseResults.length);

    // Switch to tree tab before measuring and rendering the canvas
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    document.querySelector('[data-tab="tree"]').classList.add("active");
    document.getElementById("tab-tree").classList.add("active");

    // Render parse tree with autoplay animation enabled by default
    treePlaceholder.style.display = "none";
    const rect = canvasWrapper.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    renderParseResult(0);
    renderDerivationSteps(leftmostResults, rightmostResults, grammar);
    stepToggleBtn.textContent = "❚❚";
    stepToggleBtn.title = "Pause animation";
    zoomLabel.textContent = "100%";
  }

  // ── Render Derivation Steps ──────────────────────────────────────────────
  function renderDerivationSteps(leftResult, rightResult, grammar) {
    derivationSteps.innerHTML = "";

    const root = document.createElement("div");
    root.className = "derivation-compare";
    root.appendChild(makeDerivationColumn("Leftmost Derivation", leftResult, grammar));
    root.appendChild(makeDerivationColumn("Rightmost Derivation", rightResult, grammar));

    derivationSteps.appendChild(root);
  }

  function makeDerivationColumn(title, result, grammar) {
    const col = document.createElement("div");
    col.className = "derivation-col";

    const header = document.createElement("div");
    header.className = "derivation-col-header";
    header.textContent = title;
    col.appendChild(header);

    if (!result || !result.success || !result.results.length) {
      const empty = document.createElement("div");
      empty.className = "derivation-empty";
      empty.textContent = "No derivation available.";
      col.appendChild(empty);
      return col;
    }

    result.results.forEach((entry, idx) => {
      const block = document.createElement("div");
      block.className = "derivation-card";

      const titleEl = document.createElement("div");
      titleEl.className = "derivation-card-title";
      titleEl.textContent = `Parse ${idx + 1}`;
      block.appendChild(titleEl);

      const list = document.createElement("div");
      list.className = "derivation-list";

      const start = document.createElement("div");
      start.className = "step-row";
      start.innerHTML = `<span class="step-num-badge">0</span><span class="step-start">${escHtml(grammar.startSymbol)}</span><span class="step-arrow">→</span><span class="step-sentential">${escHtml(entry.steps[0].sentential.join(' '))}</span><span class="step-arrow">→</span><span class="step-rule">Start</span>`;
      list.appendChild(start);

      const palette = [
        "#7b2fff",
        "#00e5ff",
        "#ff6b35",
        "#f5d300",
        "#24d900",
        "#ff4aa3",
        "#4b8dff",
        "#a256ff",
        "#00ffd6",
        "#ff9a00"
      ];

      const colorMap = new Map();
      const getColorForId = (id) => {
        if (!colorMap.has(id)) {
          colorMap.set(id, palette[colorMap.size % palette.length]);
        }
        return colorMap.get(id);
      };

      entry.steps.forEach((step, idx) => {
        if (idx === 0) return;
        const row = document.createElement("div");
        row.className = "step-row";

        const badge = document.createElement("span");
        badge.className = "step-num-badge";
        badge.textContent = idx;

        const sententialHTML = step.sentential.length > 0
          ? step.sentential.map((sym, symIndex) => {
              if (sym === "ε") {
                return `<span class="tm">ε</span>`;
              }

              if (grammar.isNonTerminal(sym)) {
                const id = step.ids && step.ids[symIndex] != null ? step.ids[symIndex] : (idx * 7 + symIndex);
                const color = getColorForId(id);
                return `<span class="nt" style="color:${color};">${escHtml(sym)}</span>`;
              }

              return `<span class="tm">${escHtml(sym)}</span>`;
            }).join('<span class="step-arrow"> </span>')
          : `<span class="tm">ε</span>`;

        const prefixEl = document.createElement("span");
        prefixEl.className = "step-start";
        prefixEl.textContent = escHtml(grammar.startSymbol);

        const arrowEl = document.createElement("span");
        arrowEl.className = "step-arrow";
        arrowEl.textContent = "→";

        const sentEl = document.createElement("span");
        sentEl.className = "step-sentential";
        sentEl.innerHTML = sententialHTML;

        const ruleEl = document.createElement("span");
        ruleEl.className = "step-rule";
        ruleEl.textContent = step.ruleDesc;

        row.appendChild(badge);
        row.appendChild(prefixEl);
        row.appendChild(arrowEl);
        row.appendChild(sentEl);
        row.appendChild(ruleEl);
        list.appendChild(row);
      });

      block.appendChild(list);
      col.appendChild(block);
    });

    return col;
  }

  // ── Render Grammar Info ──────────────────────────────────────────────────
  function renderGrammarInfo(summary) {
    grammarInfoEl.innerHTML = "";

    // Non-Terminals
    const ntCard = makeInfoCard("Non-Terminals (Variables)");
    const ntSet = document.createElement("div");
    ntSet.className = "info-set";
    summary.nonTerminals.forEach(sym => {
      const t = document.createElement("span");
      t.className = "info-token nt";
      t.textContent = sym;
      ntSet.appendChild(t);
    });
    ntCard.body.appendChild(ntSet);
    grammarInfoEl.appendChild(ntCard.el);

    // Terminals
    const tmCard = makeInfoCard("Terminals (Alphabet Σ)");
    const tmSet = document.createElement("div");
    tmSet.className = "info-set";
    if (summary.terminals.length === 0) {
      tmSet.innerHTML = `<span class="info-token tm">ε only</span>`;
    } else {
      summary.terminals.forEach(sym => {
        const t = document.createElement("span");
        t.className = "info-token tm";
        t.textContent = sym;
        tmSet.appendChild(t);
      });
    }
    tmCard.body.appendChild(tmSet);
    grammarInfoEl.appendChild(tmCard.el);

    // Start symbol
    const ssCard = makeInfoCard("Start Symbol");
    ssCard.body.innerHTML = `<span class="info-token nt">${escHtml(summary.startSymbol)}</span>`;
    grammarInfoEl.appendChild(ssCard.el);

    // Ambiguity
    const ambCard = makeInfoCard("Ambiguity");
    const ambiguity = summary.ambiguity || { checked: false };
    let statusText = "Not checked";
    let statusClass = "";

    if (ambiguity.checked) {
      if (ambiguity.ambiguous) {
        statusText = "Ambiguous";
        statusClass = "error";
      } else {
        statusText = "Likely unambiguous";
        statusClass = "success";
      }
    }

    ambCard.body.innerHTML = `<span class="info-token ${statusClass}">${statusText}</span>`;
    ambCard.body.innerHTML += `<div class="info-note">Ambiguity check is ${ambiguity.checked ? 'enabled' : 'disabled'}.</div>`;
    if (ambiguity.reason) {
      ambCard.body.innerHTML += `<div class="info-note">${escHtml(ambiguity.reason)}</div>`;
    }
    if (ambiguity.ambiguous && ambiguity.example) {
      ambCard.body.innerHTML += `<div class="info-note">Example yield: ${escHtml(ambiguity.example)}</div>`;
    }
    grammarInfoEl.appendChild(ambCard.el);

    // Productions
    const prodCard = makeInfoCard(`Production Rules (${summary.productionCount} total)`);
    for (const [lhs, rules] of Object.entries(summary.productions)) {
      rules.forEach(body => {
        const div = document.createElement("div");
        div.className = "rule-line";
        div.innerHTML = `<span class="nt">${escHtml(lhs)}</span> <span style="color:#5a6a7a">→</span> ${
          body.map(s =>
            s === "ε" || !isNonTerminal(s, summary.nonTerminals)
              ? `<span class="tm">${escHtml(s)}</span>`
              : `<span class="nt">${escHtml(s)}</span>`
          ).join(" ")
        }`;
        prodCard.body.appendChild(div);
      });
    }
    grammarInfoEl.appendChild(prodCard.el);
  }

  function makeInfoCard(title) {
    const el = document.createElement("div");
    el.className = "info-card";
    const header = document.createElement("div");
    header.className = "info-card-header";
    header.textContent = title;
    const body = document.createElement("div");
    body.className = "info-card-body";
    el.appendChild(header);
    el.appendChild(body);
    return { el, body };
  }

  function isNonTerminal(sym, nonTerminals) {
    return nonTerminals.includes(sym);
  }

  // ── Utilities ────────────────────────────────────────────────────────────
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  // ── Theory Sub Tabs ─────────────────────────
  document.querySelectorAll(".theory-tab").forEach(tab => {
    tab.addEventListener("click", () => {

      // remove active
      document.querySelectorAll(".theory-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".theory-content").forEach(c => c.classList.remove("active"));

      // activate clicked
      tab.classList.add("active");
      document.getElementById("theory-" + tab.dataset.theory).classList.add("active");

    });
  });
});
// // ── Theory Toggle ─────────────────────────
// document.querySelectorAll(".theory-header").forEach(header => {
//   header.addEventListener("click", () => {
//     header.parentElement.classList.toggle("active");
//   });
// });

// // ── Theory Example Loader ─────────────────
// document.querySelectorAll(".theory-btn").forEach(btn => {
//   btn.addEventListener("click", () => {
//     const preset = PRESETS[btn.dataset.load];
//     if (!preset) return;

//     document.getElementById("grammar-input").value = preset.grammar;
//     document.getElementById("string-input").value = preset.string;
//     document.getElementById("start-symbol").value = preset.start;

//     alert("Loaded example! Now click 'Generate Parse Tree'");
//   });
// });
