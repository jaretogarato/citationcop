
interface ProgressHeaderProps {
    currentReference: number;
    totalReferences: number;
  }
  export function ProgressHeader({ currentReference, totalReferences }: ProgressHeaderProps) {
    return (
      <div className="text-center space-y-2 pt-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-pink-400 inline-block text-transparent bg-clip-text mb-4">
          Analyzing References
        </h2>
        <p className="text-indigo-300">
          Checking reference {currentReference} of {totalReferences}
        </p>
      </div>
    );
  }