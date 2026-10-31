"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["Produto", "/#produto"],
  ["Como funciona", "/#como-funciona"],
  ["Planos", "/#planos"],
  ["Entrar", "/entrar"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-menu-wrap">
      <button
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="mobile-menu-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav aria-label="Navegação móvel" className="mobile-nav">
          {links.map(([label, href]) => (
            <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>
          ))}
          <a className="mobile-nav-cta" href="/cadastro" onClick={() => setOpen(false)}>
            Criar conta gratuita
          </a>
        </nav>
      )}
    </div>
  );
}
