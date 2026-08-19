import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza o conteúdo num nó fora do React tree (direto no body),
 * invisível na tela e visível apenas na impressão. Evita que
 * transforms/overflow de modais quebrem a paginação do print.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = document.createElement("div");
    node.id = "print-root";
    document.body.appendChild(node);
    setEl(node);
    return () => {
      document.body.removeChild(node);
    };
  }, []);

  if (!el) return null;
  return createPortal(children, el);
}
