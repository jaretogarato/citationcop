//app/components/ui/ModeSelector.tsx
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { Zap, SearchCheck } from 'lucide-react'

interface ModeSelectorProps {
    isHighAccuracy: boolean;
    onToggle: (checked: boolean) => void;
    disabled: boolean;
}

export function ModeSelector({ 
    isHighAccuracy = true, // Set default to true for accuracy mode
    onToggle, 
    disabled 
}: ModeSelectorProps) {
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
                        {isHighAccuracy ? 'High ACCURACY' : 'TURBO'}
                    </span>
                    {!isHighAccuracy ? (
                        <Zap className="w-4 h-4 text-red-400 animate-pulse" />
                    ) : (
                        <SearchCheck className="w-4 h-4 text-green-400" />
                    )}
                    {isHighAccuracy && (
                        <span className="text-xs font-medium bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            RECOMMENDED
                        </span>
                    )}
                </div>
                <span className={`text-sm ${
                    disabled
                        ? 'text-gray-500'
                        : isHighAccuracy
                            ? 'text-green-400'
                            : 'text-red-400'
                }`}>
                    {isHighAccuracy ? 'Slower, catch those edge cases' : 'Lightning fast validation'}
                </span>
            </Label>
        </div>
    );
}