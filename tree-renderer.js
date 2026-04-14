/**
 * tree-renderer.js
 * Renders a parse tree on a <canvas> element.
 * Supports pan and zoom.
 */

class TreeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.tree = null;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.animationStep = Infinity;
    this.animationMaxStep = 0;
    this.animationTimer = null;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Style constants
    this.NODE_RADIUS = 22;
    this.LEVEL_HEIGHT = 80;
    this.MIN_H_GAP = 40;
    this.FONT_DISPLAY = "'JetBrains Mono', monospace";

    // Colors (match CSS vars)
    this.C_BG         = "#0a0c0f";
    this.C_NT_FILL    = "#1a0d33";
    this.C_NT_BORDER  = "#7b2fff";
    this.C_NT_TEXT    = "#c9a0ff";
    this.C_TM_FILL    = "#001f26";
    this.C_TM_BORDER  = "#00e5ff";
    this.C_TM_TEXT    = "#00e5ff";
    this.C_EDGE       = "#2e3d50";
    this.C_EDGE_HI    = "#7b2fff";

    this._bindEvents();
  }

  /** Set and render a new tree */
  render(rootNode, options = {}) {
    this.stopAnimation();
    this.tree = rootNode;

    // 🔥 RESET VIEW (VERY IMPORTANT)
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._nextX = 0;
    this._layout(rootNode);
    this._fitToCanvas();

    this.animationMaxStep = this._collectMaxOrder(rootNode);

    if (options.animate) {
      this.animationStep = 0;
      this._startAnimation(options.interval || 360);
    } else {
      this.animationStep = 0;
      this._draw();
    }
  }

  /** Clear canvas */
  clear() {
    this.stopAnimation();
    this.tree = null;
    this.animationStep = 0;
    this.animationMaxStep = 0;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  stopAnimation() {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  play(interval = 250) {
    if (this.animationStep >= this.animationMaxStep) return;
    if (this.animationTimer) return;
    this._startAnimation(interval);
  }

  pause() {
    this.stopAnimation();
  }

  isPlaying() {
    return !!this.animationTimer;
  }

  stepForward() {
    if (this.animationStep < this.animationMaxStep) {
      this.animationStep++;
      this._draw();
    }
  }

  stepBackward() {
    if (this.animationStep > 0) {
      this.animationStep--;
      this._draw();
    }
  }

  getCurrentStep() {
    return this.animationStep;
  }

  _isNodeVisible(node) {
    if (this.animationStep === undefined || this.animationStep === Infinity) return true;
    return node.order === undefined || node.order <= this.animationStep;
  }

  _collectMaxOrder(node) {
    let maxOrder = node.order || 0;
    if (node.children) {
      for (const child of node.children) {
        maxOrder = Math.max(maxOrder, this._collectMaxOrder(child));
      }
    }
    return maxOrder;
  }

  _startAnimation(interval) {
    if (this.animationStep === undefined) this.animationStep = 0;
    if (this.animationStep > this.animationMaxStep) this.animationStep = this.animationMaxStep;
    this._emitStepChange();
    this._draw();
    if (this.animationStep >= this.animationMaxStep) {
      this.animationTimer = null;
      return;
    }
    this.animationTimer = setTimeout(() => this._animateNextStep(interval), interval);
  }

  _animateNextStep(interval) {
    if (this.animationStep >= this.animationMaxStep) {
      this.animationTimer = null;
      return;
    }

    this.animationStep += 1;
    this._emitStepChange();
    this._draw();
    if (this.animationStep >= this.animationMaxStep) {
      this.animationTimer = null;
      return;
    }
    this.animationTimer = setTimeout(() => this._animateNextStep(interval), interval);
  }

  _emitStepChange() {
    if (typeof this.onStepChange === "function") {
      this.onStepChange(this.animationStep);
    }
  }

  // ── Layout (Reingold-Tilford-ish) ─────────────────────────────────────────
  _layout(root) {
    // Assign x positions using post-order
    this._assignX(root);
    // Assign y positions by depth
    this._assignY(root, 0);
    // Center tree
    const bounds = this._getBounds(root);
    const shiftX = -bounds.minX + this.NODE_RADIUS * 2;
    this._shiftX(root, shiftX);
  }

  _assignX(node) {
    if (!node.children || node.children.length === 0) {
      node.x = this._nextX;
      node.subtreeWidth = this.NODE_RADIUS * 2;
      this._nextX += this.NODE_RADIUS * 3;
      return;
    }

    for (const child of node.children) {
      this._assignX(child);
    }

    // Fix overlap using subtree width
    for (let i = 1; i < node.children.length; i++) {
      const left = node.children[i - 1];
      const right = node.children[i];

      const minGap = this.NODE_RADIUS * 3;

      const overlap =
        (left.x + left.subtreeWidth / 2 + minGap) -
        (right.x - right.subtreeWidth / 2);

      if (overlap > 0) {
        this._shiftSubtree(right, overlap);
      }
    }

    const first = node.children[0];
    const last = node.children[node.children.length - 1];

    node.x = (first.x + last.x) / 2;

    // 🔥 calculate subtree width
    node.subtreeWidth =
      (last.x + last.subtreeWidth / 2) -
      (first.x - first.subtreeWidth / 2);
  }
  _shiftSubtree(node, dx) {
    node.x += dx;
    if (node.children) {
      for (const child of node.children) {
        this._shiftSubtree(child, dx);
      }
    }
  }

  _assignY(node, depth) {
    node.y = depth * this.LEVEL_HEIGHT + 50;

    if (node.children) {
      for (const child of node.children) {
        this._assignY(child, depth + 1);
      }
    }
  }
  _shiftX(node, dx) {
    node.x += dx;
    if (node.children) {
      for (const child of node.children) this._shiftX(child, dx);
    }
  }

  _getBounds(node) {
    let minX = node.x, maxX = node.x, maxY = node.y;
    if (node.children) {
      for (const child of node.children) {
        const b = this._getBounds(child);
        minX = Math.min(minX, b.minX);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    return { minX, maxX, maxY };
  }

  // ── Fit to canvas ─────────────────────────────────────────────────────────
  _fitToCanvas() {
    if (!this.tree) return;
    const bounds = this._getBounds(this.tree);
    const treeW = bounds.maxX - bounds.minX + this.NODE_RADIUS * 4;
    const treeH = bounds.maxY + this.NODE_RADIUS * 4;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    const scaleX = canvasW / treeW;
    const scaleY = canvasH / treeH;
    this.scale = Math.min(scaleX, scaleY, 1.4);

    this.offsetX = (canvasW - treeW * this.scale) / 2;
    this.offsetY = 20;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  _draw() {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = this.C_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!this.tree) return;

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Draw edges first
    this._drawEdges(this.tree);
    // Draw nodes on top
    this._drawNodes(this.tree);

    ctx.restore();
  }

  _drawEdges(node) {
    if (!this._isNodeVisible(node) || !node.children || node.children.length === 0) return;
    for (const child of node.children) {
      if (this._isNodeVisible(child)) {
        this._drawEdge(node, child);
      }
      this._drawEdges(child);
    }
  }

  _drawEdge(from, to) {
    const ctx = this.ctx;
    const isToTerminal = to.isTerminal;
    const strokeColor = isToTerminal ? "#00e5ff" : "#7b2fff";

    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const fromOffset = this.NODE_RADIUS * 0.9;
    const toOffset = isToTerminal ? 20 : this.NODE_RADIUS * 0.9;
    const startX = from.x + Math.cos(angle) * fromOffset;
    const startY = from.y + Math.sin(angle) * fromOffset;
    const endX = to.x - Math.cos(angle) * toOffset;
    const endY = to.y - Math.sin(angle) * toOffset;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    this._drawArrowHead(endX, endY, angle, strokeColor);
  }

  _drawArrowHead(x, y, angle, color) {
    const ctx = this.ctx;
    const size = 14;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.lineTo(-size, -size * 0.55);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  _drawNodes(node) {
    if (!this._isNodeVisible(node)) return;
    this._drawNode(node);
    if (node.children) {
      for (const child of node.children) this._drawNodes(child);
    }
  }

  _drawNode(node) {
    const ctx = this.ctx;
    const r = this.NODE_RADIUS;
    const isEpsilon = node.symbol === "ε";

    if (node.isTerminal) {
      // Terminal: circle
      ctx.shadowColor = this.C_TM_BORDER;
      ctx.shadowBlur = isEpsilon ? 4 : 10;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.C_TM_FILL;
      ctx.fill();
      ctx.strokeStyle = this.C_TM_BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.fillStyle = this.C_TM_TEXT;
      ctx.font = `bold ${r * 0.85}px ${this.FONT_DISPLAY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.symbol, node.x, node.y);
    } else {
      // Non-terminal: circle
      ctx.shadowColor = this.C_NT_BORDER;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.C_NT_FILL;
      ctx.fill();
      ctx.strokeStyle = this.C_NT_BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.fillStyle = this.C_NT_TEXT;
      ctx.font = `bold ${r * 0.85}px ${this.FONT_DISPLAY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.symbol, node.x, node.y);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener("mousedown", e => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    canvas.addEventListener("mousemove", e => {
      if (!this.isDragging) return;
      this.offsetX += e.clientX - this.lastMouseX;
      this.offsetY += e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this._draw();
    });

    canvas.addEventListener("mouseup",   () => { this.isDragging = false; });
    canvas.addEventListener("mouseleave", () => { this.isDragging = false; });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.scale *= delta;
      this.scale = Math.max(0.2, Math.min(this.scale, 4));
      this._draw();
    }, { passive: false });

    // Touch support
    let lastTouchDist = null;
    canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
      }
    });

    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        this.offsetX += e.touches[0].clientX - this.lastMouseX;
        this.offsetY += e.touches[0].clientY - this.lastMouseY;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this._draw();
      } else if (e.touches.length === 2 && lastTouchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        this.scale *= dist / lastTouchDist;
        this.scale = Math.max(0.2, Math.min(this.scale, 4));
        lastTouchDist = dist;
        this._draw();
      }
    }, { passive: false });

    canvas.addEventListener("touchend", () => {
      this.isDragging = false;
      lastTouchDist = null;
    });
  }

  zoom(factor) {
    this.scale *= factor;
    this.scale = Math.max(0.2, Math.min(this.scale, 4));
    this._draw();
    return Math.round(this.scale * 100);
  }

  resetZoom() {
    this._fitToCanvas();
    this._draw();
    return Math.round(this.scale * 100);
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.tree) {
      this._fitToCanvas();
      this._draw();
    }
  }
}
