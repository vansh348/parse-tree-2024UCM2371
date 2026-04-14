# CFG Visualizer — Parse Tree Generator

> A browser-based tool to generate **derivations** and **parse trees** for Context-Free Grammars (CFG), built for **Compiler Design** and **Theory of Computation** courses.

![CFG Visualizer](https://img.shields.io/badge/CFG-Visualizer-00e5ff?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3bDEwIDUgMTAtNXoiLz48L3N2Zz4=)
![HTML](https://img.shields.io/badge/HTML5-CSS3-JS-vanilla-brightgreen?style=flat-square)
![No Dependencies](https://img.shields.io/badge/dependencies-none-success?style=flat-square)

---

## 🌳 Features

| Feature | Details |
|---|---|
| **Grammar Input** | Enter any CFG using `→` or `->` notation |
| **Parse Tree** | Canvas-based interactive parse tree with pan & zoom |
| **Derivation Steps** | Step-by-step leftmost or rightmost derivation |
| **Grammar Analysis** | Automatic extraction of N, Σ, S, P |
| **Presets** | Arithmetic, Palindrome, aⁿbⁿ, Balanced Parentheses |
| **No dependencies** | Pure HTML/CSS/JavaScript — open in any browser |

---

## 🚀 Getting Started

### Run Locally (No Setup Required)

```bash
git clone https://github.com/YOUR_USERNAME/cfg-visualizer.git
cd cfg-visualizer
# Just open index.html in your browser!
open index.html
```

Or serve with any static server:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

---

## 📖 How to Use

### 1. Define Grammar Rules

Enter one rule per line. Use `→` or `->` or `=>` as the production arrow.
Separate alternatives with `|`.

```
S → aS | bA
A → aA | b
```

Terminals are **lowercase** characters/words.  
Non-terminals are **Uppercase** characters/words.

### 2. Enter the Input String

Type the string you want to derive, e.g. `aab`.  
For multi-character terminals, separate tokens with spaces: `id + id * id`.

### 3. Choose Derivation Strategy

- **Leftmost** — always expand the leftmost non-terminal first
- **Rightmost** — always expand the rightmost non-terminal first (canonical for LR parsers)

### 4. Click "Generate Parse Tree"

The tool will:
- Validate the grammar
- Run a recursive backtracking parser
- Render an interactive parse tree
- Show all derivation steps
- Display a grammar analysis summary

---

## 🧮 Grammar Notation

| Symbol type | Example | Convention |
|---|---|---|
| Non-terminal | `S`, `Expr`, `Term` | Uppercase |
| Terminal | `a`, `b`, `+`, `id` | Lowercase / symbol |
| Epsilon | `ε` or `eps` | Empty production |
| Arrow | `→` or `->` or `=>` | Rule separator |
| Alternative | `\|` | OR separator |

### Example Grammars

**Arithmetic Expressions:**
```
E → E + T | T
T → T * F | F
F → ( E ) | id
```

**Balanced Parentheses:**
```
S → ( S ) | S S | ε
```

**aⁿbⁿ (n ≥ 1):**
```
S → a S b | a b
```

---

## 🗂️ Project Structure

```
cfg-visualizer/
├── index.html              # Main HTML entry point
├── css/
│   └── style.css           # Dark terminal aesthetic styling
├── js/
│   ├── grammar.js          # CFG grammar parser & representation
│   ├── parser.js           # Recursive backtracking CFG parser
│   ├── tree-renderer.js    # Canvas-based parse tree renderer
│   └── app.js              # UI controller / main app logic
└── README.md
```

---

## 🛠️ Technical Details

### Grammar Module (`grammar.js`)
- Tokenizes and parses CFG rules from text
- Supports multi-character non-terminals (`Expr`, `Term`, etc.)
- Automatically infers the terminal set Σ
- Validates grammar and produces error messages

### Parser Module (`parser.js`)
- Recursive backtracking top-down parser
- Implements both **leftmost** and **rightmost** derivation
- Builds a tree of `TreeNode` objects
- Records each `DerivationStep` for the steps panel

### Tree Renderer (`tree-renderer.js`)
- Draws on HTML5 `<canvas>`
- Uses a Reingold-Tilford-inspired layout algorithm
- **Non-terminals** → purple circles
- **Terminals** → cyan rounded rectangles
- Supports mouse/touch **pan and zoom**

---

## 📚 Academic Use

This tool directly supports topics in:

- **Theory of Computation** — Formal language theory, CFGs, derivations, CYK
- **Compiler Design** — Parse trees, top-down parsing, leftmost/rightmost derivation
- **Discrete Mathematics** — Formal grammars, BNF notation

---

## 📝 License

MIT License — free for academic and personal use.

---

*Built with pure HTML/CSS/JavaScript — no frameworks, no build step.*
