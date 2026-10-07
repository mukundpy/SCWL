import { Routes, Route, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Shipments from "@/pages/Shipments";
import ShipmentNew from "@/pages/ShipmentNew";
import ShipmentDetail from "@/pages/ShipmentDetail";
import Track from "@/pages/Track";
import { Products, Suppliers, Warehouses, Carriers } from "@/pages/Master";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="shipments/new" element={<ShipmentNew />} />
        <Route path="shipments/:id" element={<ShipmentDetail />} />
        <Route path="track" element={<Track />} />
        <Route path="track/:id" element={<Track />} />
        <Route path="products" element={<Products />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="carriers" element={<Carriers />} />
        <Route path="*" element={
          <div className="py-20 text-center">
            <p className="text-lg font-medium">Page not found</p>
            <Link to="/" className="mt-2 inline-block text-indigo-600 hover:underline">Back to dashboard</Link>
          </div>} />
      </Route>
    </Routes>
  );
}
