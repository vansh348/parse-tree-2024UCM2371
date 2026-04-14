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
      errors.push("No grammar rules found. Please enter at least one production rule (e.g., S → a | b).");
    }
    if (!this.nonTerminals.has(this.startSymbol)) {
      errors.push(`Start symbol '${this.startSymbol}' is not defined in any production rule. Ensure it appears on the left side of at least one rule.`);
    }
    // Check for unreachable non-terminals
    const reachable = new Set();
    const queue = [this.startSymbol];
    while (queue.length > 0) {
      const nt = queue.shift();
      if (reachable.has(nt)) continue;
      reachable.add(nt);
      if (this.productions[nt]) {
        for (const body of this.productions[nt]) {
          for (const sym of body) {
            if (this.isNonTerminal(sym) && !reachable.has(sym)) {
              queue.push(sym);
            }
          }
        }
      }
    }
    for (const nt of this.nonTerminals) {
      if (!reachable.has(nt)) {
        errors.push(`Non-terminal '${nt}' is unreachable from the start symbol. It may be unused or cause parsing issues.`);
      }
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
  // Basic Examples
  arithmetic: {
    grammar: `E → E + E | E * E | id`,
    string: "id + id * id",
    start: "E",
    description: "Arithmetic expressions (ambiguous)"
  },
  palindrome: {
    grammar: `S → a S a | b S b | ε`,
    string: "abba",
    start: "S",
    description: "Palindromes"
  },
  anbn: {
    grammar: `S → a S b | a b`,
    string: "aaabbb",
    start: "S",
    description: "Equal a's followed by b's"
  },
  balanced: {
    grammar: `S → ( S ) S | ε`,
    string: "(())",
    start: "S",
    description: "Balanced parentheses"
  },

  // LL(1) Grammars
  simple_expr: {
    grammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    string: "id + id * id",
    start: "E",
    description: "Simple expressions (LL(1))"
  },
  if_statement: {
    grammar: `S → if C then S else S | if C then S | other
C → true | false`,
    string: "if true then if false then other else other",
    start: "S",
    description: "If-then-else statements (LL(1))"
  },

  // Ambiguous Examples
  dangling_else: {
    grammar: `S → if C then S | if C then S else S | other
C → true | false`,
    string: "if true then if false then other else other",
    start: "S",
    description: "Dangling else problem (ambiguous)"
  },
  assoc_expr: {
    grammar: `E → E + E | E - E | E * E | E / E | id`,
    string: "id + id - id",
    start: "E",
    description: "Associativity ambiguity"
  },

  // Language Theory Examples
  even_length: {
    grammar: `S → a S a | b S b | ε`,
    string: "abba",
    start: "S",
    description: "Even length palindromes"
  },
  binary_palindrome: {
    grammar: `S → 0 S 0 | 1 S 1 | 0 | 1 | ε`,
    string: "0110",
    start: "S",
    description: "Binary palindromes"
  },

  // Regular Language Examples
  ab_star: {
    grammar: `S → a S | ε`,
    string: "aaa",
    start: "S",
    description: "a* (Kleene star)"
  },
  alternating: {
    grammar: `S → a B | ε
B → b A
A → a B | ε`,
    string: "abab",
    start: "S",
    description: "Alternating a and b"
  }
};
