/**
 * parser.js
 */

class TreeNode {
  constructor(symbol, isTerminal) {
    this.symbol = symbol;
    this.isTerminal = isTerminal;
    this.children = [];
  }
}

class DerivationStep {
  constructor(sentential, ruleDesc, ids = [], expandedIndex = null, expandedLength = 0) {
    this.sentential = sentential;
    this.ruleDesc = ruleDesc;
    this.ids = ids;
    this.expandedIndex = expandedIndex;
    this.expandedLength = expandedLength;
  }
}

class CFGParser {
  constructor(grammar) {
    this.grammar = grammar;
    this.maxDepth = 14;
    this.maxStates = 5000;
    this.maxResults = 12;
  }

  parseAll(input, strategy = 'leftmost') {
    if (!this.grammar.isValid()) {
      return { success: false, error: this.grammar.getErrors().join('\n') };
    }

    const tokens = this._tokenizeInput(input);
    this.strategy = strategy;

    this.symbolIdCounter = 1;
    const startRoot = new TreeNode(this.grammar.startSymbol, false);
    startRoot.order = 0;
    const startStep = new DerivationStep([this.grammar.startSymbol], 'Start', [0], 0, 1);
    const queue = [
      {
        sentential: [this.grammar.startSymbol],
        ids: [0],
        root: startRoot,
        steps: [startStep],
        depth: 0,
      },
    ];

    const results = [];
    let processed = 0;

    while (queue.length > 0 && processed < this.maxStates && results.length < this.maxResults) {
      const state = queue.shift();
      processed += 1;

      if (state.depth > this.maxDepth) continue;

      const targetIndex = this._selectNextNonterminal(state.sentential);
      if (targetIndex === -1) {
        if (this._matchesTokens(state.sentential, tokens)) {
          results.push({ tree: state.root, steps: state.steps });
        }
        continue;
      }

      const lhs = state.sentential[targetIndex];
      let rules = this.grammar.productions[lhs] || [];
      if (this.strategy === 'rightmost') {
        rules = [...rules].reverse();
      }

      for (const body of rules) {
        const nextSentential = [
          ...state.sentential.slice(0, targetIndex),
          ...body,
          ...state.sentential.slice(targetIndex + 1),
        ];

        const nextIds = [
          ...state.ids.slice(0, targetIndex),
          ...body.map(() => this._getNextSymbolId()),
          ...state.ids.slice(targetIndex + 1),
        ];

        if (!this._isPossibleSentential(nextSentential, tokens)) continue;

        const nextSteps = state.steps.concat(
          new DerivationStep(nextSentential, `${lhs} → ${body.join(' ')}`, nextIds, targetIndex, body.length)
        );
        const expansionOrder = nextSteps.length - 1;
        const nextRoot = this._cloneTreeWithExpansion(state.root, targetIndex, body, expansionOrder);

        queue.push({
          sentential: nextSentential,
          ids: nextIds,
          root: nextRoot,
          steps: nextSteps,
          depth: state.depth + 1,
        });
      }
    }

    if (results.length === 0) {
      return { success: false, error: 'String cannot be derived.' };
    }

    return { success: true, results };
  }

  parse(input, strategy = 'leftmost') {
    const all = this.parseAll(input, strategy);
    if (!all.success) return all;
    const first = all.results[0];
    return { success: true, tree: first.tree, steps: first.steps, total: all.results.length };
  }

  _tokenizeInput(input) {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'ε') return [];

    return trimmed.includes(' ') ? trimmed.split(/\s+/) : trimmed.split('');
  }

  _selectNextNonterminal(sentential) {
    if (this.strategy === 'rightmost') {
      for (let i = sentential.length - 1; i >= 0; i--) {
        if (this.grammar.isNonTerminal(sentential[i])) return i;
      }
      return -1;
    }
    return sentential.findIndex(sym => this.grammar.isNonTerminal(sym));
  }

  _getNextSymbolId() {
    return this.symbolIdCounter++;
  }

  _matchesTokens(sentential, tokens) {
    const yieldSymbols = sentential.filter(sym => sym !== 'ε');
    if (yieldSymbols.length !== tokens.length) return false;
    return yieldSymbols.every((sym, idx) => sym === tokens[idx]);
  }

  _isPossibleSentential(sentential, tokens) {
    const terminals = sentential.filter(
      sym => sym !== 'ε' && !this.grammar.isNonTerminal(sym)
    );
    if (terminals.length > tokens.length) return false;

    if (this.strategy === 'leftmost') {
      const prefix = [];
      for (const sym of sentential) {
        if (sym === 'ε') continue;
        if (this.grammar.isNonTerminal(sym)) break;
        prefix.push(sym);
      }
      for (let i = 0; i < prefix.length; i++) {
        if (tokens[i] !== prefix[i]) return false;
      }
    } else {
      const suffix = [];
      for (let i = sentential.length - 1; i >= 0; i--) {
        const sym = sentential[i];
        if (sym === 'ε') continue;
        if (this.grammar.isNonTerminal(sym)) break;
        suffix.unshift(sym);
      }
      for (let i = 0; i < suffix.length; i++) {
        if (tokens[tokens.length - suffix.length + i] !== suffix[i]) return false;
      }
    }

    return true;
  }

  _cloneTreeWithExpansion(root, targetLeafIndex, body, order) {
    return this._cloneNode(root, targetLeafIndex, body, order).node;
  }

  _cloneNode(node, targetLeafIndex, body, order) {
    const clone = new TreeNode(node.symbol, node.isTerminal);
    clone.order = node.order;

    if (!node.children || node.children.length === 0) {
      if (targetLeafIndex !== 0) {
        return { node: clone, found: false, leafCount: 1 };
      }

      if (body.length === 1 && body[0] === 'ε') {
        const child = new TreeNode('ε', true);
        child.order = order;
        clone.children = [child];
      } else {
        clone.children = body.map(s => {
          const child = new TreeNode(s, !this.grammar.isNonTerminal(s) || s === 'ε');
          child.order = order;
          return child;
        });
      }

      return { node: clone, found: true, leafCount: 1 };
    }

    clone.children = [];
    let leafCount = 0;
    let found = false;

    for (const child of node.children) {
      const result = this._cloneNode(child, targetLeafIndex - leafCount, body, order);
      clone.children.push(result.node);
      leafCount += result.leafCount;
      if (result.found) found = true;
    }

    return { node: clone, found, leafCount };
  }
}
