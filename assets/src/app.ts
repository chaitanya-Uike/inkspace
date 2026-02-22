import { Editor } from "./editor";
import { CollabSession } from "./session";
import { debounce } from "./utils";

let session: CollabSession;

const editor = new Editor(
  "",
  (selection) => session.onSelectionChange(selection),
  debounce((newContent: string) => session.onContentChange(newContent), 500),
);

session = new CollabSession(editor);
editor.attach("#editor");
