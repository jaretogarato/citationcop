import React from 'react';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Gift, ArrowRight, Info } from 'lucide-react';

interface TrialStateProps {
  remainingReferences: number;
  canProcessReferences: boolean;
}

const TrialState = ({ remainingReferences, canProcessReferences }: TrialStateProps) => {
  if (!canProcessReferences) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card
          title="Reference Limit Reached"
          description="You've used all your trial references. Sign up for a free account and you will have 7 days to verify 100 references. Or choose from our affordable plans."
          footer={
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
              Sign up for full access
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          }
        >
          <div className="flex justify-center items-center py-6">
            <div className="rounded-full bg-zinc-800 p-3">
              <Info className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card
      title="Free Trial"
      description={`You can verify ${remainingReferences} more reference${remainingReferences === 1 ? '' : 's'}. Sign up for unlimited access.`}
      footer={
        <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
          Upgrade now
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      }
    >
      <div className="flex justify-center items-center py-4">
        <div className="rounded-full bg-zinc-800 p-3">
          <Gift className="w-6 h-6 text-blue-500" />
        </div>
      </div>
    </Card>
  );
};

export default TrialState;