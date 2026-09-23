import { GlobalWindow } from "happy-dom";

const window = new GlobalWindow();
globalThis.window = window as any;
globalThis.document = window.document as any;
globalThis.HTMLElement = window.HTMLElement as any;
globalThis.customElements = window.customElements as any;
