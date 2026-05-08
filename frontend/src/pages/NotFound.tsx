import { Link, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

const NotFound = () => {
  const location = useLocation();

  return (
    <AppShell>
      <div className="min-h-full medflow-page-bg px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col items-center">
        <header className="w-full max-w-[480px] mb-6">
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">Page not found</h1>
          <p className="text-[#6B7280] mt-1">This URL is not part of MedFlow.</p>
        </header>
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-8 max-w-[480px] w-full text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-[rgba(4, 120, 87,0.12)] text-[#047857] flex items-center justify-center font-bold">
            404
          </div>
          <p className="text-[#1A1A2E] text-lg font-semibold mt-4">We couldn&apos;t find that page</p>
          <p className="text-[#6B7280] mt-2">
            `{location.pathname}` does not match any MedFlow page.
          </p>
          <Link
            to="/"
            className="inline-flex mt-6 medflow-primary-button rounded-lg px-5 py-2.5 font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
};

export default NotFound;
