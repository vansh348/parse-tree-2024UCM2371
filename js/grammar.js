/**
 * grammar.js
 * Parses and represents Context-Free Grammar rules.
 * Supports notation: S → a | bA  or  S -> a | bA
 */

class Grammar {
  constructor() {
    this.productions = {}; // { "S": [["a","S"], ["b","A"]], ... }
    this.startSymbol = "S";
    this.nonTerminals = new Set();
    this.terminals = new Set();
  }

  /**
   * Parse grammar text.
   * Each line: LHS → body1 | body2 | ...
   * Symbols are single characters OR uppercase words for non-terminals.
   */
  parse(text, startSymbol = "S") {
    this.productions = {};
    this.nonTerminals = new Set();
    this.terminals = new Set();
    this.startSymbol = startSymbol.trim();

    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      // Split on → or -> or =>
      const parts = line.split(/→|->|=>/);
      if (parts.length < 2) continue;

      const lhs = parts[0].trim();
      if (!lhs) continue;

      this.nonTerminals.add(lhs);
      if (!this.productions[lhs]) this.productions[lhs] = [];

      const rhsPart = parts.slice(1).join("→");
      const alternatives = rhsPart.split("|");

      for (const alt of alternatives) {
        const symbols = this._tokenize(alt.trim());
        if (symbols.length > 0) {
          this.productions[lhs].push(symbols);
        }
      }
    }

    // Infer terminals: symbols that appear on RHS but not as LHS
    for (const lhs of Object.keys(this.productions)) {
      for (const body of this.productions[lhs]) {
        for (const sym of body) {
          if (!this.nonTerminals.has(sym) && sym !== "ε" && sym !== "eps") {
            this.terminals.add(sym);
          }
        }
      }
    }

    return this;
  }

  /**
   * Tokenize a production body.
   * Uppercase words (or single uppercase) = non-terminals
   * Lowercase, digits, punctuation = terminal chars
   * ε or eps = epsilon
   */
  _tokenize(body) {
    if (!body || body === "ε" || body === "eps" || body === "epsilon") {
      return ["ε"];
    }

    // If spaces exist → use them
    if (body.includes(" ")) {
      return body.split(/\s+/).filter(Boolean);
    }

    // Otherwise, intelligently parse tokens
    const tokens = [];
    let i = 0;

    while (i < body.length) {
      // Handle multi-letter tokens like id
      if (/[a-z]/.test(body[i])) {
        let j = i;
        while (j < body.length && /[a-z]/.test(body[j])) j++;
        tokens.push(body.slice(i, j)); // "id"
        i = j;
      }
      // Handle non-terminals like E'
      else if (/[A-Z]/.test(body[i])) {
        let j = i + 1;
        if (body[j] === "'") j++; // include prime
        tokens.push(body.slice(i, j)); // "E'"
        i = j;
      }
      // Operators and symbols
      else {
        tokens.push(body[i]);
        i++;
      }
    }

    return tokens;
  }

  isNonTerminal(sym) {
    return this.nonTerminals.has(sym);
  }

  isTerminal(sym) {
    return this.terminals.has(sym) || sym === "ε";
  }

  isValid() {
    return Object.keys(this.productions).length > 0 &&
           this.nonTerminals.has(this.startSymbol);
  }

  getErrors() {
    const errors = [];
    if (Object.keys(this.productions).length === 0) {
      errors.push("No grammar rules found. Please enter at least one rule.");
    }
    if (!this.nonTerminals.has(this.startSymbol)) {
      errors.push(`Start symbol '${this.startSymbol}' not found in grammar rules.`);
    }
    return errors;
  }

  getSummary() {
    return {
      nonTerminals: [...this.nonTerminals].sort(),
      terminals: [...this.terminals].sort(),
      startSymbol: this.startSymbol,
      productions: this.productions,
      productionCount: Object.values(this.productions).reduce((s, v) => s + v.length, 0)
    };
  }

  checkAmbiguity(options = {}) {
    if (!this.isValid()) {
      return { checked: false, ambiguous: false, reason: "Invalid grammar" };
    }

    const maxDepth = options.maxDepth || 8;
    const maxStates = options.maxStates || 4000;
    const queue = [{ sentential: [this.startSymbol], history: [], depth: 0 }];
    const completed = new Map();
    const visitCounts = new Map();
    let processed = 0;

    while (queue.length > 0 && processed < maxStates) {
      const state = queue.shift();
      processed += 1;

      if (state.depth > maxDepth) {
        continue;
      }

      const ntIndex = state.sentential.findIndex(sym => this.isNonTerminal(sym));
      if (ntIndex === -1) {
        const yieldKey = this._joinYield(state.sentential);
        const trace = state.history.join(" | ");

        if (completed.has(yieldKey) && completed.get(yieldKey) !== trace) {
          return {
            checked: true,
            ambiguous: true,
            reason: "Ambiguous derivations found.",
            example: yieldKey
          };
        }

        if (!completed.has(yieldKey)) {
          completed.set(yieldKey, trace);
        }

        continue;
      }

      const lhs = state.sentential[ntIndex];
      const rules = this.productions[lhs] || [];

      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        const body = rules[ruleIndex];
        const nextSentential = [
          ...state.sentential.slice(0, ntIndex),
          ...body.filter(s => s !== "ε"),
          ...state.sentential.slice(ntIndex + 1)
        ];

        const nextKey = `${nextSentential.join(" ")}|${state.depth + 1}|${ruleIndex}`;
        const count = visitCounts.get(nextKey) || 0;
        if (count >= 4) continue;
        visitCounts.set(nextKey, count + 1);

        queue.push({
          sentential: nextSentential,
          history: [...state.history, `${lhs}→${body.join(" ") || "ε"}#${ruleIndex}`],
          depth: state.depth + 1
        });
      }
    }

    if (processed >= maxStates) {
      return {
        checked: false,
        ambiguous: false,
        reason: "Search limit reached; ambiguity is unknown."
      };
    }

    return {
      checked: true,
      ambiguous: false,
      reason: `No ambiguous derivations found within ${maxDepth} expansions.`
    };
  }

  _joinYield(sentential) {
    if (sentential.length === 0) return "ε";
    return sentential.join(" ");
  }
}

// Presets
const PRESETS = {
  arithmetic: {
    grammar: `E → E + E | E * E | id`,
    string: "id + id * id",
    start: "E"
  },
  palindrome: {
    grammar: `S → a S a | b S b | ε`,
    string: "abba",
    start: "S"
  },
  anbn: {
    grammar: `S → a S b | a b`,
    string: "aaabbb",
    start: "S"
  },
  balanced: {
    grammar: `S → ( S ) S | ε`,
    string: "(())",
    start: "S"
  }
};
