import type { ReactNode } from "react";

type StatCardProps = {
  iconBg: string;
  icon: ReactNode;
  label: string;
  value: string | number;
};

export function StatCard({ iconBg, icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex items-center px-[25px] py-[25px] gap-[24px] min-h-[98px]">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[#3C4A42] text-[12px] font-semibold tracking-[0.6px] uppercase leading-4">
          {label}
        </p>
        <p className="text-[#161D19] text-[24px] font-semibold leading-8 tracking-[-0.48px] mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
