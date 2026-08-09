"use client";

import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function useDropdownSearch() {
  useEffect(() => {
    const enhance = root => root.querySelectorAll?.("select:not([data-search-ready])").forEach(select => {
      if (select.closest(".searchable-select")) return;
      select.dataset.searchReady = "true";
      const list = document.createElement("datalist");
      const input = document.createElement("input");
      const listId = `options-${Math.random().toString(36).slice(2)}`;
      list.id = listId; input.type = "search"; input.className = "native-combobox-input"; input.setAttribute("list", listId); input.autocomplete = "off";
      const refresh = () => {
        list.replaceChildren(...[...select.options].filter(option => option.value).map(option => { const node = document.createElement("option"); node.value = option.text; return node; }));
        input.value = select.selectedOptions[0]?.text || ""; input.placeholder = select.options[0]?.text || "Search options…";
      };
      input.addEventListener("focus", () => input.select());
      input.addEventListener("change", () => {
        const match = [...select.options].find(option => option.text.toLowerCase() === input.value.trim().toLowerCase());
        if (match) { select.value = match.value; select.dispatchEvent(new Event("change", { bubbles: true })); }
        refresh();
      });
      select.addEventListener("change", refresh); select.classList.add("native-combobox-select"); select.before(input, list); refresh();
    });
    enhance(document);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && enhance(node))));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

export function SearchableSelect({ children, onChange, searchPlaceholder = "Search options…", ...props }) {
  const text = value => Children.toArray(value).map(part => typeof part === "string" || typeof part === "number" ? part : "").join("");
  const options = useMemo(() => Children.toArray(children).filter(child => isValidElement(child) && child.type === "option").map(child => ({ value: String(child.props.value ?? text(child.props.children)), label: text(child.props.children), disabled: child.props.disabled })), [children]);
  const controlled = props.value !== undefined, initial = String(props.defaultValue ?? "");
  const [internal, setInternal] = useState(initial), [query, setQuery] = useState(""), [open, setOpen] = useState(false), [menuPosition, setMenuPosition] = useState(null);
  const inputRef = useRef(null), selectedValue = controlled ? String(props.value ?? "") : internal;
  const selected = options.find(option => option.value === selectedValue), visible = options.filter(option => option.value && option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const choose = option => {
    if (option.disabled) return;
    if (!controlled) setInternal(option.value);
    setQuery(""); setOpen(false); inputRef.current?.setCustomValidity("");
    onChange?.({ target: { value: option.value, name: props.name }, currentTarget: { value: option.value, name: props.name } });
  };
  useEffect(() => {
    if (!open) { setMenuPosition(null); return undefined; }
    const position = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const placeAbove = below < 190 && above > below;
      const maxHeight = Math.max(120, Math.min(300, placeAbove ? above : below));
      setMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), maxHeight, ...(placeAbove ? { bottom: window.innerHeight - rect.top + 3 } : { top: rect.bottom + 3 }) });
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);
  const display = open ? query : selected?.label || "";
  const menu = open && menuPosition && <div className="combobox-menu combobox-portal" style={menuPosition} role="listbox">{visible.length ? visible.map(option => <button type="button" role="option" aria-selected={option.value === selectedValue} disabled={option.disabled} key={option.value} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option.label}</button>) : <span>No matching option</span>}</div>;
  return <div className="searchable-select"><input ref={inputRef} type="search" value={display} placeholder={selected?.label || options.find(option => !option.value)?.label || searchPlaceholder} aria-label={searchPlaceholder} autoComplete="off" required={props.required} onFocus={event => { setQuery(""); setOpen(true); event.currentTarget.select(); }} onChange={event => { setQuery(event.target.value); setOpen(true); event.currentTarget.setCustomValidity("Choose an option from the list."); }} onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); inputRef.current?.setCustomValidity(selectedValue ? "" : props.required ? "Choose an option from the list." : ""); }, 120)} /><input type="hidden" name={props.name} value={selectedValue} />{typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}</div>;
}

export function Button({ children, variant = "solid", ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

export function AsyncButton({ children, busyText = "Preparing image…", onClick, ...props }) {
  const [busy, setBusy] = useState(false);
  const run = async event => {
    if (busy) return;
    setBusy(true);
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    try { await onClick?.(event); }
    catch (error) { console.error(error); window.alert("The image could not be generated. Please try again."); }
    finally { setBusy(false); }
  };
  return <Button type="button" {...props} disabled={busy || props.disabled} aria-busy={busy} onClick={run}>{busy && <span className="button-spinner" aria-hidden="true" />}{busy ? busyText : children}</Button>;
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
