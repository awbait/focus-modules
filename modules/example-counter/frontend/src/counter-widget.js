class ExampleCounterCounterWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._value = 0;
    this._step = 1;
    this._unsub = null;
    this._focus = null;
  }

  connectedCallback() {
    this._focus = window.FocusSDK.create(this);
    this._render();
    this._loadSettings();
    this._loadValue();

    this._unsub = this._focus.on("value.changed", (payload) => {
      this._value = payload.value;
      this._updateDisplay();
    });

    this._focus.ready();
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  async _loadSettings() {
    try {
      const settings = await this._focus.getSettings();
      if (settings && settings.step > 0) {
        this._step = settings.step;
      }
    } catch {
      // Use default step = 1
    }
  }

  async _loadValue() {
    try {
      const data = await this._focus.api("GET", "/value");
      this._value = data.value;
      this._updateDisplay();
    } catch (err) {
      console.error("example-counter: load value failed", err);
    }
  }

  async _increment() {
    try {
      const data = await this._focus.api("POST", "/increment", { step: this._step });
      this._value = data.value;
      this._updateDisplay();
    } catch (err) {
      console.error("example-counter: increment failed", err);
    }
  }

  async _decrement() {
    try {
      const data = await this._focus.api("POST", "/decrement", { step: this._step });
      this._value = data.value;
      this._updateDisplay();
    } catch (err) {
      console.error("example-counter: decrement failed", err);
    }
  }

  async _reset() {
    try {
      const data = await this._focus.api("POST", "/reset");
      this._value = data.value;
      this._updateDisplay();
    } catch (err) {
      console.error("example-counter: reset failed", err);
    }
  }

  _updateDisplay() {
    const el = this.shadowRoot.querySelector(".value");
    if (el) el.textContent = this._value;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          color: var(--foreground, #e2e8f0);
        }
        .value {
          font-size: 3rem;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border, #334155);
          background: var(--card, #1e293b);
          color: var(--foreground, #e2e8f0);
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.25rem;
          font-weight: 600;
          width: 40px;
          height: 40px;
          transition: background 0.15s;
        }
        button:hover {
          background: var(--accent, #334155);
        }
        button:active {
          transform: scale(0.95);
        }
        .reset {
          font-size: 0.75rem;
          width: auto;
          padding: 0 12px;
          height: 32px;
        }
      </style>
      <div class="value">${this._value}</div>
      <div class="controls">
        <button class="dec" title="Decrement">&minus;</button>
        <button class="reset">Reset</button>
        <button class="inc" title="Increment">+</button>
      </div>
    `;

    this.shadowRoot.querySelector(".inc").addEventListener("click", () => this._increment());
    this.shadowRoot.querySelector(".dec").addEventListener("click", () => this._decrement());
    this.shadowRoot.querySelector(".reset").addEventListener("click", () => this._reset());
  }
}

customElements.define("example-counter-counter-widget", ExampleCounterCounterWidget);
