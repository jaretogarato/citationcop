import UserDropdown from "./UserDropdown";

export default async function Header() {

    return (
        <div>
            {/* Header with Logo */}
            <nav className="bg-gray-800/50 backdrop-blur-sm rounded-full px-8 py-4 flex items-center justify-between border border-indigo-500/20">
                <div className="w-48">
                    <svg viewBox="0 0 320 40" className="w-full">
                        <text x="20" y="28" fontFamily="Arial" fontWeight="bold" fontSize="24" fill="#8B5CF6">Citation</text>
                        <text x="110" y="28" fontFamily="Arial" fontWeight="bold" fontSize="24" fill="#EC4899">Cop</text>
                        <circle cx="170" cy="20" r="12" fill="#1E293B" />

                        <path d="M165 20 L170 25 L179 16" stroke="#10B981" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                    </svg>
                </div>
                <div className="flex gap-8 text-gray-300">
                    <button className="hover:text-indigo-400 transition-colors">About us</button>
                    <a className="hover:text-indigo-400 transition-colors cursor-pointer">Pricing</a>


                    <UserDropdown />

                </div>
            </nav>
        </div>
    );
}