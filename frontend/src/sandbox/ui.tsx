import { type ReactNode } from "react";
export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Input(props: any) {
  return <input {...props} className={inputClass} />;
}
export function Select(props: any) {
  return <select {...props} className={inputClass} />;
}
export function Button({ children, secondary = false, ...props }: any) {
  return (
    <button
      {...props}
      className={`${secondary ? "border border-border bg-card hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"} inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
export function Panel({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Badge({ children }: any) {
  return (
    <span className="inline-block rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">
      {children}
    </span>
  );
}
export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-border p-3 font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td
                    key={j}
                    className="border-b border-border/60 p-3 align-top"
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="p-6 text-center text-muted-foreground"
              >
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function ErrorBox({ error }: any) {
  return error ? (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      {error.message || String(error)}
    </div>
  ) : null;
}
