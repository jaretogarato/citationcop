// components/StatsCards.tsx
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface StatsData {
  totalCount: number;
  verified: number;
  invalid: number;
  warning: number;
}

interface StatsCardsProps {
  data: StatsData;
}

export function StatsCards({ data }: StatsCardsProps) {
  return (
    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
      {/* Total References */}
      <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-sm">
        <p className="text-3xl font-bold text-white">{data.totalCount}</p>
        <p className="text-indigo-300 text-sm">Total References</p>
      </div>

      {/* Verified */}
      <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/50 rounded-2xl p-4">
        <div className="flex items-center justify-center mb-2">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        </div>
        <p className="text-3xl font-bold text-white">{data.verified}</p>
        <p className="text-emerald-300 text-sm">Verified</p>
      </div>

      {/* Invalid */}
      <div className="bg-gradient-to-br from-rose-900/50 to-rose-800/50 rounded-2xl p-4">
        <div className="flex items-center justify-center mb-2">
          <XCircle className="h-5 w-5 text-rose-400" />
        </div>
        <p className="text-3xl font-bold text-white">{data.invalid}</p>
        <p className="text-rose-300 text-sm">Invalid</p>
      </div>

      {/* Need Review */}
      <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/50 rounded-2xl p-4">
        <div className="flex items-center justify-center mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <p className="text-3xl font-bold text-white">{data.warning}</p>
        <p className="text-amber-300 text-sm">Need Review</p>
      </div>
    </div>
  );
}