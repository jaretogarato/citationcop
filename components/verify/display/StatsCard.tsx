import { CheckCircle, XCircle, AlertTriangle, Library } from "lucide-react";

interface StatsData {
  totalCount: number;
  verified: number;
  invalid: number;
  warning: number;
}

interface StatsCardsProps {
  data: StatsData;
}

const cardInfo = {
  totalCount: {
    title: "Total References",
    description: "All references found.",
    details: "This number represents all references that have were gathered from the input.",
    icon: Library,
    colors: {
      gradient: "from-indigo-900/50 to-indigo-800/50",
      text: "text-indigo-300",
      iconColor: "text-indigo-400",
      accent: "bg-indigo-400/10"
    }
  },
  verified: {
    title: "Verified",
    description: "Confirmed with reliable sources",
    details: "References that have been cross-checked with multiple academic databases and trusted sources, ensuring their authenticity and accuracy.",
    icon: CheckCircle,
    colors: {
      gradient: "from-emerald-900/50 to-emerald-800/50",
      text: "text-emerald-300",
      iconColor: "text-emerald-400",
      accent: "bg-emerald-400/10"
    }
  },
  invalid: {
    title: "Invalid",
    description: "The reference could not be verified",
    details: "No information was found that could corroborate the reference. It is impossible to prove a negative, but if it can't be found through a google search, it's likely invalid.",
    icon: XCircle,
    colors: {
      gradient: "from-rose-900/50 to-rose-800/50",
      text: "text-rose-300",
      iconColor: "text-rose-400",
      accent: "bg-rose-400/10"
    }
  },
  warning: {
    title: "Need Review",
    description: "Requires manual verification",
    details: "References with partial matches or conflicting information that need human expertise to verify their accuracy and completeness.",
    icon: AlertTriangle,
    colors: {
      gradient: "from-amber-900/50 to-amber-800/50",
      text: "text-amber-300",
      iconColor: "text-amber-400",
      accent: "bg-amber-400/10"
    }
  }
};

function StatsCard({ 
  value, 
  info, 
}: { 
  value: number;
  info: typeof cardInfo[keyof typeof cardInfo];
}) {
  const Icon = info.icon;
  
  return (
    <div className="h-48 w-full [perspective:1000px] cursor-pointer">
      <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Front */}
        <div className={`absolute inset-0 bg-gradient-to-br ${info.colors.gradient} rounded-2xl p-4 [backface-visibility:hidden] flex flex-col`}>
          {/* Top section with icon */}
          <div className="flex items-center justify-center mb-1">
            <Icon className={`h-8 w-8 ${info.colors.iconColor}`} />
          </div>
          
          {/* Middle section with title and number */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className={`${info.colors.text} text-xl font-medium mb-2`}>{info.title}</p>
            <p className="text-5xl font-bold text-white">{value}</p>
          </div>
          
          {/* Bottom section with description */}
          <div className="mt-auto">
            <p className={`${info.colors.text} text-xs text-center opacity-80`}>
              {info.description}
            </p>
          </div>
        </div>

        {/* Back */}
        <div 
          className={`absolute inset-0 bg-gradient-to-br ${info.colors.gradient} rounded-2xl p-4 [transform:rotateY(180deg)] [backface-visibility:hidden]`}
        >
          <div className={`${info.colors.accent} rounded-lg p-3 h-full flex flex-col justify-center`}>
            <p className={`${info.colors.text} text-sm leading-relaxed`}>
              {info.details}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ data }: StatsCardsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
      {Object.entries(cardInfo).map(([key, info]) => (
        <div key={key} className="group">
          <StatsCard 
            value={data[key as keyof StatsData]} 
            info={info}
          />
        </div>
      ))}
    </div>
  );
}