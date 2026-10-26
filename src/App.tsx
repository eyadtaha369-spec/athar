import { Route, Routes } from "react-router-dom";
import StoreLayout from "./components/Layout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductPage from "./pages/Product";
import Checkout from "./pages/Checkout";
import { OrderDone, Track } from "./pages/Order";
import AdminLayout from "./admin/AdminLayout";
import Overview from "./admin/Overview";
import Orders from "./admin/Orders";
import Products from "./admin/Products";
import { Settings, Team } from "./admin/TeamSettings";

export default function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="p/:slug" element={<ProductPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/:number" element={<OrderDone />} />
        <Route path="track" element={<Track />} />
        <Route path="*" element={<Home />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Overview />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
