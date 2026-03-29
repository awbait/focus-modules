class ExampleCounterChartWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._history = [];
    this._unsub = null;
    this._focus = null;
  }

  connectedCallback() {
    this._focus = window.FocusSDK.create(this);
    this._render();
    this._loadHistory();

    this._unsub = this._focus.on("value.changed", () => {
      this._loadHistory();
    });

    this._focus.ready();
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  async _loadHistory() {
    try {
      const data = await this._focus.api("GET", "/history?limit=50");
      // API returns newest first, reverse for chronological chart
      this._history = Array.isArray(data) ? data.reverse() : [];
      this._renderChart();
    } catch (err) {
      console.error("example-counter: load history failed", err);
    }
  }

  _renderChart() {
    const container = this.shadowRoot.querySelector(".chart-container");
    if (!container) return;

    if (this._history.length === 0) {
      container.innerHTML = '<div class="empty">No data yet</div>';
      return;
    }

    const values = this._history.map((e) => e.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 1);
    const range = maxVal - minVal || 1;

    const padding = { top: 20, right: 16, bottom: 28, left: 40 };
    const width = 400;
    const height = 200;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = values.map((v, i) => {
      const x = padding.left + (i / Math.max(values.length - 1, 1)) * chartW;
      const y = padding.top + chartH - ((v - minVal) / range) * chartH;
      return { x, y, v };
    });

    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

    // Fill area
    const areaPath = [
      `M ${points[0].x},${padding.top + chartH}`,
      ...points.map((p) => `L ${p.x},${p.y}`),
      `L ${points[points.length - 1].x},${padding.top + chartH}`,
      "Z",
    ].join(" ");

    // Grid lines (4 horizontal)
    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      const val = Math.round(maxVal - (i / 4) * range);
      gridLines.push(`
        <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}"
              stroke="var(--border, #334155)" stroke-width="0.5" stroke-dasharray="4,4" />
        <text x="${padding.left - 6}" y="${y + 4}" text-anchor="end"
              fill="var(--muted-foreground, #94a3b8)" font-size="10">${val}</text>
      `);
    }

    // Data point dots
    const dots = points
      .map(
        (p) =>
          `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--primary, #3b82f6)" />`
      )
      .join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"
           style="width:100%;height:100%;">
        ${gridLines.join("")}
        <path d="${areaPath}" fill="var(--primary, #3b82f6)" opacity="0.1" />
        <polyline points="${polyline}" fill="none"
                  stroke="var(--primary, #3b82f6)" stroke-width="2" stroke-linejoin="round" />
        ${dots}
      </svg>
    `;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: system-ui, -apple-system, sans-serif;
          color: var(--foreground, #e2e8f0);
        }
        .header {
          font-size: 0.875rem;
          font-weight: 600;
          padding: 8px 12px 4px;
          opacity: 0.7;
        }
        .chart-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 8px 8px;
          min-height: 0;
        }
        .empty {
          font-size: 0.8rem;
          opacity: 0.5;
          text-align: center;
        }
      </style>
      <div class="header">Counter History</div>
      <div class="chart-container">
        <div class="empty">Loading...</div>
      </div>
    `;
  }
}

customElements.define("example-counter-chart-widget", ExampleCounterChartWidget);
