import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Boxes, Truck, Package, Factory, Warehouse, Route, MapPin, Menu, X } from "lucide-react";
import clsx from "clsx";
import { useEffect } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/shipments", label: "Shipments", icon: Truck },
  { to: "/track", label: "Track", icon: MapPin },
  { sep: "Master data" },
  { to: "/products", label: "Products", icon: Package },
  { to: "/suppliers", label: "Suppliers", icon: Factory },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse },
  { to: "/carriers", label: "Carriers", icon: Route },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5 px-3">
      {nav.map((n, i) =>
        "sep" in n ? (
          <div key={i} className="px-3 pb-1 pt-5 text-xs font-medium uppercase tracking-wide text-slate-400">{n.sep}</div>
        ) : (
          <NavLink key={n.to} to={n.to} end={"end" in n ? n.end : false} onClick={onNavigate}
            className={({ isActive }) => clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100")}>
            <n.icon className="h-[18px] w-[18px]" />{n.label}
          </NavLink>
        )
      )}
    </nav>
  );
}

const Brand = () => (
  <div className="flex items-center gap-2 px-6 py-5">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><Truck className="h-4 w-4" /></span>
    <div className="leading-tight"><div className="text-sm font-semibold text-slate-900">SCWL</div><div className="text-xs text-slate-500">Logistics</div></div>
  </div>
);

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen md:pl-60">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 bg-white md:block"><Brand /><NavList /></aside>

      {/* mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><Truck className="h-5 w-5 text-indigo-600" />SCWL</div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            <Brand /><NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8"><Outlet /></main>
    </div>
  );
}
