import { Selection } from "./selection";

export interface RemoteUser {
  id: string;
  label: string;
  selection: Selection;
  labelVisible?: boolean;
}

export class ContentChangeEvent extends Event {
  constructor(public readonly content: string) {
    super("content-change");
  }
}

export class SelectionChangeEvent extends Event {
  constructor(public readonly selection: Selection) {
    super("selection-change");
  }
}

export class Editor extends EventTarget {
  private container: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private mirror: HTMLDivElement;
  private remoteUsers: Map<string, RemoteUser> = new Map();
  private labelTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(initialContent: string) {
    super();
    this.mirror = document.createElement("div");
    this.mirror.className = "mirror";

    this.textarea = document.createElement("textarea");
    this.textarea.value = initialContent;
    this.textarea.spellcheck = false;

    this.container = document.createElement("div");
    this.container.className = "editor-container";
    this.container.appendChild(this.mirror);
    this.container.appendChild(this.textarea);

    const wrapper = document.createElement("div");
    wrapper.className = "editor-wrapper";
    wrapper.appendChild(this.container);

    this.container = wrapper as any;
    this.setupEvents();
    this.render();

    (this as any)._root = wrapper;
  }

  attach(selector: string) {
    document.querySelector(selector)?.append(this.el);
  }

  getContent() {
    return this.textarea.value;
  }

  get el(): HTMLElement {
    return (this as any)._root;
  }

  private setupEvents() {
    this.textarea.addEventListener("scroll", () => {
      this.mirror.scrollTop = this.textarea.scrollTop;
      this.mirror.scrollLeft = this.textarea.scrollLeft;
    });

    this.textarea.addEventListener("input", () => {
      this.onContentChanged(this.textarea.value);
      this.render();
    });

    document.addEventListener("selectionchange", () => {
      if (document.activeElement === this.textarea) {
        const state = this.getSelectionState();
        this.onSelectionChanged(state);
      }
    });
  }

  private onContentChanged(newContent: string) {
    this.dispatchEvent(new ContentChangeEvent(newContent));
  }

  private onSelectionChanged(selection: Selection) {
    this.dispatchEvent(new SelectionChangeEvent(selection));
  }

  private getSelectionState(): Selection {
    const { selectionStart, selectionEnd, selectionDirection } = this.textarea;
    if (selectionDirection === "backward") {
      return { anchor: selectionEnd, head: selectionStart };
    }
    return { anchor: selectionStart, head: selectionEnd };
  }

  setContent(content: string) {
    const { selectionStart, selectionEnd } = this.textarea;
    this.textarea.value = content;
    this.textarea.setSelectionRange(selectionStart, selectionEnd);
    this.render();
  }

  setRemoteUser(user: RemoteUser) {
    this.remoteUsers.set(user.id, user);

    const existing = this.labelTimers.get(user.id);
    if (existing) clearTimeout(existing);

    const userData = this.remoteUsers.get(user.id)!;
    userData.labelVisible = true;

    const timer = setTimeout(() => {
      const u = this.remoteUsers.get(user.id);
      if (u) {
        u.labelVisible = false;
        this.render();
      }
    }, 2000);

    this.labelTimers.set(user.id, timer);
    this.render();
  }

  removeRemoteUser(id: string) {
    this.remoteUsers.delete(id);
    this.render();
  }

  getRemoteUsers(): RemoteUser[] {
    return Object.values(this.remoteUsers);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private isFirstLine(pos: number, text: string): boolean {
    return !text.slice(0, pos).includes("\n");
  }

  private render() {
    const text = this.textarea.value;
    const users = Array.from(this.remoteUsers.values());

    type Event =
      | { pos: number; type: "open" | "close"; user: RemoteUser }
      | { pos: number; type: "cursor"; user: RemoteUser };

    const events: Event[] = [];

    users.forEach((user) => {
      const { anchor, head } = user.selection;
      const start = Math.min(anchor, head);
      const end = Math.max(anchor, head);

      if (start === end) {
        events.push({ pos: start, type: "cursor", user });
      } else {
        events.push({ pos: start, type: "open", user });
        events.push({ pos: end, type: "close", user });
      }
    });

    events.sort((a, b) => a.pos - b.pos || (a.type === "close" ? -1 : 1));

    let html = "";
    let pos = 0;

    for (const event of events) {
      html += this.escapeHtml(text.slice(pos, event.pos));
      pos = event.pos;

      const color = this.stringToColor(event.user.id);

      if (event.type === "cursor") {
        const firstLine = this.isFirstLine(event.pos, text);
        const labelClass = `cursor-label${firstLine ? " cursor-label--below" : ""}`;
        const labelHtml = event.user.labelVisible
          ? `<span class="${labelClass}" style="background:${color.solid}">${this.escapeHtml(event.user.label)}</span>`
          : "";
        html += `<span style="border-left: 2px solid ${color.solid}; margin-left: -1px; position: relative;">${labelHtml}</span>`;
      } else if (event.type === "open") {
        const firstLine = this.isFirstLine(event.pos, text);
        const labelClass = `cursor-label${firstLine ? " cursor-label--below" : ""}`;
        const labelHtml = event.user.labelVisible
          ? `<span class="${labelClass}" style="background:${color.solid}">${this.escapeHtml(event.user.label)}</span>`
          : "";
        html += `<span class="remote-highlight" style="background:${color.highlight}; border-bottom: 2px solid ${color.solid}; position: relative;">${labelHtml}`;
      } else {
        html += `</span>`;
      }
    }

    html += this.escapeHtml(text.slice(pos));
    this.mirror.innerHTML = html;
  }

  private stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    const h = Math.abs(hash) % 360;
    const s = 55 + (Math.abs(hash >> 8) % 25);
    const l = 45 + (Math.abs(hash >> 16) % 20);

    return {
      solid: `hsl(${h}, ${s}%, ${l}%)`,
      highlight: `hsla(${h}, ${s}%, ${l}%, 0.28)`,
    };
  }
}
