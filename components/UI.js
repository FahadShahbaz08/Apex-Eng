"use client";

import { Children, isValidElement, useEffect, useState } from "react";

export function useDropdownSearch() {
  useEffect(() => {
    const enhance = root => root.querySelectorAll?.("select:not([data-search-ready])").forEach(select => {
      if (select.closest(".searchable-select")) return;
      select.dataset.searchReady = "true";
      const search = document.createElement("input");
      search.type = "search";
      search.className = "native-select-search";
      search.placeholder = "Search options…";
      search.setAttribute("aria-label", "Search dropdown options");
      search.autocomplete = "off";
      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        [...select.options].forEach(option => {
          option.hidden = Boolean(option.value) && !option.text.toLowerCase().includes(query);
        });
      });
      select.before(search);
    });
    enhance(document);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && enhance(node))));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

export function SearchableSelect({ children, onChange, searchPlaceholder = "Search options…", ...props }) {
  const [query, setQuery] = useState("");
  const options = Children.toArray(children);
  const filtered = options.filter(child => {
    if (!isValidElement(child) || child.type !== "option") return true;
    if (child.props.value === "") return true;
    return String(child.props.children ?? "").toLowerCase().includes(query.trim().toLowerCase());
  });
  return <div className="searchable-select"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} autoComplete="off" /><select {...props} onChange={event => { setQuery(""); onChange?.(event); }}>{filtered}</select></div>;
}

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
