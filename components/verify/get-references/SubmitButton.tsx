import { Loader2, Ban } from "lucide-react";

interface SubmitButtonProps {
  isProcessing: boolean;
  isLimitReached?: boolean;  // New prop for limit reached state
  disabled: boolean;
  onClick: () => void;
}

export function SubmitButton({ 
  isProcessing, 
  isLimitReached = false,  // Default to false
  disabled, 
  onClick 
}: SubmitButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled || isProcessing || isLimitReached}
      className={`
        px-8 py-6 rounded-2xl text-lg font-medium shadow-lg
        transition-all duration-200
        ${isLimitReached 
          ? 'bg-gray-400 cursor-not-allowed' // Limit reached state
          : disabled || isProcessing
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 opacity-50 cursor-not-allowed' // Just disabled state
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500' // Active state
        }
        text-white
      `}
    >
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing...
        </div>
      ) : isLimitReached ? (
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          Limit Reached
        </div>
      ) : (
        'Check References'
      )}
    </button>
  );
}