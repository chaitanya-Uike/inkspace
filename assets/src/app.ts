import { Editor } from "./editor";
import { CollabSession } from "./session";

const editor = new Editor("");
new CollabSession(editor);

editor.attach("#editor");
