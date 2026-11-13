import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';

export default function Layout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <TopNav />
      <main className="flex-grow-1">
        <Outlet />
      </main>
    </div>
  );
}
