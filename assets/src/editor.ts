export interface SelectionState {
  anchor: number;
  head: number;
}

export interface RemoteUser {
  id: string;
  label: string;
  color: string;
  selection: SelectionState;
  labelVisible?: boolean;
}

type SelectionChangeCallback = (state: SelectionState) => void;
type ContentChangeCallback = (content: string) => void;

export class Editor {
  private container: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private mirror: HTMLDivElement;
  private remoteUsers: Map<string, RemoteUser> = new Map();

  private onSelectionChange: SelectionChangeCallback;
  private onContentChange: ContentChangeCallback;
  private labelTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    initialContent: string,
    onSelectionChange: SelectionChangeCallback,
    onContentChange: ContentChangeCallback,
  ) {
    this.onSelectionChange = onSelectionChange;
    this.onContentChange = onContentChange;

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

    (this as any).root = wrapper;
  }

  get el(): HTMLElement {
    return (this as any).root;
  }

  private setupEvents() {
    this.textarea.addEventListener("scroll", () => {
      this.mirror.scrollTop = this.textarea.scrollTop;
      this.mirror.scrollLeft = this.textarea.scrollLeft;
    });

    this.textarea.addEventListener("input", () => {
      this.onContentChange(this.textarea.value);
      this.render();
    });

    document.addEventListener("selectionchange", () => {
      if (document.activeElement === this.textarea) {
        const state = this.getSelectionState();
        this.onSelectionChange(state);
      }
    });
  }

  private getSelectionState(): SelectionState {
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

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

      if (event.type === "cursor") {
        const labelHtml = event.user.labelVisible
          ? `<span class="cursor-label" style="background:${event.user.color}">${this.escapeHtml(event.user.label)}</span>`
          : "";
        html += `<span style="border-left: 2px solid ${event.user.color}; margin-left: -1px; position: relative;">${labelHtml}</span>`;
      } else if (event.type === "open") {
        const labelHtml = event.user.labelVisible
          ? `<span class="cursor-label" style="background:${event.user.color}">${this.escapeHtml(event.user.label)}</span>`
          : "";
        html += `<span class="remote-highlight" style="background:${event.user.color}44; border-bottom: 2px solid ${event.user.color}; position: relative;">${labelHtml}`;
      } else {
        html += `</span>`;
      }
    }

    html += this.escapeHtml(text.slice(pos));
    this.mirror.innerHTML = html;
  }

  getRemoteSelections(): { userId: string; selection: SelectionState }[] {
    return Array.from(this.remoteUsers.entries()).map(([id, user]) => ({
      userId: id,
      selection: user.selection,
    }));
  }
}
