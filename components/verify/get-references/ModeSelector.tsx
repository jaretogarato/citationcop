import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Zap, SearchCheck } from 'lucide-react';

interface ModeSelectorProps {
    isHighAccuracy: boolean;
    onToggle: (checked: boolean) => void;
    disabled: boolean;
}

export function ModeSelector({ isHighAccuracy, onToggle, disabled }: ModeSelectorProps) {
    return (
        <div className="flex items-start space-x-2">
            <Switch
                id="high-accuracy-mode"
                checked={isHighAccuracy}
                onCheckedChange={onToggle}
                disabled={disabled}
                className="data-[state=checked]:bg-red-500 data-[state=unchecked]:bg-blue-500"
            />
            <Label
                htmlFor="high-accuracy-mode"
                className={`flex flex-col ${disabled ? 'text-gray-500' : 'text-gray-200'}`}
            >
                <div className="flex items-center gap-2">
                    <span className="font-semibold">
                        {isHighAccuracy ? 'ACCURACY Mode' : 'TURBO Mode'}
                    </span>
                    {!isHighAccuracy ? (
                        <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
                    ) : (
                        <SearchCheck className="w-4 h-4 text-red-400" />
                    )}
                </div>
                <span className={`text-sm ${disabled
                    ? 'text-gray-500'
                    : isHighAccuracy
                        ? 'text-red-400'
                        : 'text-blue-400'
                    }`}>
                    {isHighAccuracy ? 'Slower, catch those edge cases' : 'Lightning fast validation'}
                </span>
            </Label>
        </div>
    );
}