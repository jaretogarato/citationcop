interface StatusCardProps {
    icon: React.ReactNode;
    label: string;
    count: number;
}

export default function StatusCard({ icon, label, count }: StatusCardProps) {
    return (
        <div className="bg-gray-800/80 rounded-xl p-3 border border-indigo-500/20 group hover:bg-gray-800 transition-all duration-200">
            <div className="flex items-center justify-center space-x-2">
                <div className="group-hover:scale-110 transition-transform duration-200">
                    {icon}
                </div>
                <span className="text-indigo-300 text-base">
                    {count} {label}
                </span>
            </div>
        </div>
    );
}