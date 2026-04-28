import { useTheme } from "./ThemeProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

export interface NoticeBodyValue {
  readonly subject: string;
  readonly body: string;
}

interface Props {
  readonly value: NoticeBodyValue;
  readonly onChange: (next: NoticeBodyValue) => void;
  readonly availableTokens?: readonly string[];
  readonly disabled?: boolean;
  readonly height?: number;
}

/**
 * Subject + markdown body editor used by the Generate Notice modal and any
 * future invoice/letter generators. Body uses @uiw/react-md-editor (split-pane
 * preview built in). Tokens like {{investor.legalName}} are shown as
 * clickable chips that insert into the body at the cursor.
 */
export function NoticeBodyEditor({
  value,
  onChange,
  availableTokens,
  disabled,
  height = 360,
}: Props) {
  const { theme } = useTheme();

  const insertToken = (token: string) => {
    if (disabled) return;
    onChange({ ...value, body: `${value.body}${value.body.endsWith(" ") || value.body.length === 0 ? "" : " "}${token}` });
  };

  return (
    <div className="space-y-3" data-color-mode={theme}>
      <div>
        <Label htmlFor="notice-subject">Subject</Label>
        <Input
          id="notice-subject"
          value={value.subject}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          placeholder="e.g. Capital Call Notice — Due 2026-08-05"
        />
      </div>

      <div>
        <Label>Body (Markdown)</Label>
        <div className="rounded-md border border-border overflow-hidden">
          <MDEditor
            value={value.body}
            onChange={(next) => onChange({ ...value, body: next ?? "" })}
            height={height}
            preview="live"
            visibleDragbar={false}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Use Markdown: <code>**bold**</code>, headings <code>#</code>, lists, and pipe tables. Tokens below resolve when the notice is rendered.
        </p>
      </div>

      {availableTokens && availableTokens.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Insert token</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTokens.map((tok) => (
              <button
                key={tok}
                type="button"
                disabled={disabled}
                onClick={() => insertToken(tok)}
                className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {tok}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
