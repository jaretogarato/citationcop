import { Loader2 } from "lucide-react";

interface SubmitButtonProps {
  isProcessing: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function SubmitButton({ isProcessing, disabled, onClick }: SubmitButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled || isProcessing}
      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-6 rounded-2xl text-lg font-medium shadow-lg disabled:opacity-70 disabled:hover:from-indigo-600 disabled:hover:to-purple-600 transition-all duration-200"
    >
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing...
        </div>
      ) : (
        'Check References'
      )}
    </button>
  );
}