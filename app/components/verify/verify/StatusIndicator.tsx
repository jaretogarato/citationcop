import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import StatusCard from "./StatusCard";

interface StatusIndicatorsProps {
    stats: {
        verified: number;
        issues: number;
        pending: number;
    };
}

export function StatusIndicators({ stats }: StatusIndicatorsProps) {
    return (
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            <StatusCard
                icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                label="Verified"
                count={stats.verified}
            />
            <StatusCard
                icon={<AlertCircle className="h-5 w-5 text-yellow-500" />}
                label="Issues Found"
                count={stats.issues}
            />
            <StatusCard
                icon={<Clock className="h-5 w-5 text-indigo-400" />}
                label="Pending"
                count={stats.pending}
            />
        </div>
    );
}