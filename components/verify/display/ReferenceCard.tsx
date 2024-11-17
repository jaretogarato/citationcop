import { Reference, ReferenceStatus } from '@/types/reference';
import Card from '@/components/ui/Card';
import CardContent from "@/components/ui/Card";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface ReferenceCardProps {
  reference: Reference;
}

export function ReferenceCard({ reference }: ReferenceCardProps) {
  const getStatusColor = (status: ReferenceStatus): string => ({
    verified: "from-emerald-900 to-emerald-800",
    unverified: "from-rose-900 to-rose-800",
    error: "from-amber-900 to-amber-800",
    pending: "from-blue-900 to-blue-800"
  }[status] || "from-gray-900 to-gray-800");

  const getStatusIcon = (status: ReferenceStatus): JSX.Element | null => ({
    verified: <CheckCircle className="h-6 w-6 text-emerald-400" />,
    error: <AlertTriangle className="h-6 w-6 text-amber-400" />,
    pending: <AlertTriangle className="h-6 w-6 text-blue-400" />,
    unverified: <XCircle className="h-6 w-6 text-rose-400" />
  }[status] || null);

  const getStatusText = (status: ReferenceStatus): string => ({
    verified: "Verified",
    error: "Needs Review",
    pending: "Pending",
    unverified: "Could not be verified"
  }[status] || status);

  const formatAuthors = (authors: string[] = []) => {
    if (authors.length === 0) return '';
    if (authors.length <= 2) return authors.join(', ');
    return `${authors[0]}, ${authors[1]} et al.`;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const renderMessageWithLinks = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^]+?)([.,)\]}>])?(?=\s|$)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(message)) !== null) {
      if (match.index > lastIndex) {
        parts.push(message.slice(lastIndex, match.index));
      }

      const [_, url, punctuation] = match;
      const cleanUrl = url.replace(/[.,)\]}>]+$/, '');

      if (isValidUrl(cleanUrl)) {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
            title={cleanUrl}
          >
            here
          </a>
        );
      } else {
        // If URL is invalid, just render it as text
        parts.push(cleanUrl);
      }

      if (punctuation) {
        parts.push(punctuation);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
      parts.push(message.slice(lastIndex));
    }

    return parts;
  };

  return (
    <Card title="" variant="borderless">
      <div className={`w-full min-w-[280px] max-w-[400px] justify-self-center bg-gradient-to-br ${getStatusColor(reference.status)} rounded-[1.5rem] overflow-hidden shadow-xl`}>
        <CardContent title={''}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-black/20 rounded-xl p-3">
              {getStatusIcon(reference.status)}
              <span className="text-lg font-semibold text-white">
                {getStatusText(reference.status)}
              </span>
            </div>

            <div className="space-y-3 bg-black/20 rounded-xl p-4">
              <div>
                <h3 className="text-sm font-medium text-indigo-300">Title</h3>
                <p className="text-white font-medium leading-tight">{reference.title}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-indigo-300">Authors</h3>
                <p className="text-white font-medium leading-tight">{formatAuthors(reference.authors)}</p>
              </div>
            </div>

            {reference.message && (
              <div className="bg-black/20 rounded-xl p-4">
                <h3 className="text-sm font-medium text-indigo-300 mb-1">Verification Notes</h3>
                <div className="max-h-24 overflow-y-auto">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {renderMessageWithLinks(reference.message)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default ReferenceCard;