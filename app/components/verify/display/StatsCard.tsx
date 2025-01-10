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
    details: "No information is found that corroborates the reference. You can't prove a negative, but if it doesn't show up on a google search, it likely doesn't exist.",
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
    description: "Requires human verification",
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
    <div className="relative h-48 w-full">
      {/* Front content */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${info.colors.gradient} rounded-2xl p-4 flex flex-col
          transition-opacity duration-300 group-hover:opacity-0`}
      >
        <div className="flex items-center justify-center mb-1">
          <Icon className={`h-8 w-8 ${info.colors.iconColor}`} />
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className={`${info.colors.text} text-xl font-medium mb-2`}>{info.title}</p>
          <p className="text-5xl font-bold text-white">{value}</p>
        </div>
        
        <div className="mt-auto">
          <p className={`${info.colors.text} text-xs text-center opacity-80`}>
            {info.description}
          </p>
        </div>
      </div>

      {/* Back content */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${info.colors.gradient} rounded-2xl p-4
          opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      >
        <div className={`${info.colors.accent} rounded-lg p-3 h-full flex flex-col justify-center`}>
          <p className={`${info.colors.text} text-sm leading-relaxed`}>
            {info.details}
          </p>
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ data }: StatsCardsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
      {Object.entries(cardInfo).map(([key, info]) => (
        <div key={key} className="group cursor-pointer">
          <StatsCard 
            value={data[key as keyof StatsData]} 
            info={info}
          />
        </div>
      ))}
    </div>
  );
}