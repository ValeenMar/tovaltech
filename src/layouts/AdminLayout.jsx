import { useApp } from '../context/AppContext';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import Modal from '../components/ui/Modal';
import Dashboard from '../pages/Dashboard';
import Orders from '../pages/Orders';
import Products from '../pages/Products';
import Customers from '../pages/Customers';
import Invoices from '../pages/Invoices';
import Analytics from '../pages/Analytics';
import Settings from '../pages/Settings';

const pages = {
  dashboard: Dashboard,
  orders: Orders,
  products: Products,
  customers: Customers,
  invoices: Invoices,
  analytics: Analytics,
  settings: Settings,
};

export default function AdminLayout() {
const { currentPage } = useApp();
const Page = pages[currentPage] || Dashboard;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Page />
        </main>
      </div>
      <Modal />
    </div>
  );
}