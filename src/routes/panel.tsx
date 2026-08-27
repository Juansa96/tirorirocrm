import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout de /panel. Solo pinta el <Outlet/>: la lista vive en panel.index.tsx
// (/panel) y la ficha en panel.$id.tsx (/panel/$id). Antes la lista estaba en
// este archivo sin <Outlet/>, así que la ficha (ruta hija) nunca se renderizaba:
// la URL cambiaba a /panel/<id> pero se seguía viendo la lista.
export const Route = createFileRoute("/panel")({
  head: () => ({ meta: [{ title: "Mi taller — Tiroriro" }] }),
  component: () => <Outlet />,
});
