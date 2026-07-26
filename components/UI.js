"use client";

export function Button({ children, variant = "solid", ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

export function Field({ label, hint, children }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Status({ children }) {
  return <span className={`status ${String(children).toLowerCase().replaceAll(" ", "-")}`}>{children}</span>;
}

export function Empty({ title, text, action }) {
  return <div className="empty-state"><span>+</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Table({ headers, children }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function Modal({ title, eyebrow, close, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className={`modal ${wide ? "wide" : ""}`}><header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button onClick={close}>×</button></header>{children}</div></div>;
}

export function Panel({ eyebrow, title, description, actions, children, className = "" }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="button-row">{actions}</div>}</div>{children}</section>;
}

export function FormActions({ close, submit = "Save" }) {
  return <div className="form-actions"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit">{submit}</Button></div>;
}

export function ErrorText({ children }) { return children ? <p className="form-error">{children}</p> : null; }
