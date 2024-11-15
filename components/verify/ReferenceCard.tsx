import { Reference, ReferenceType, ReferenceStatus } from '@/types/reference';
import Card from '@/components/ui/Card';
import CardContent from "@/components/ui/Card";
import { CheckCircle, XCircle, AlertTriangle, Book, FileText, Globe, Scroll, GraduationCap, FileCode, BookOpen } from "lucide-react";

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

  const getTypeIcon = (type?: ReferenceType): JSX.Element => {
    const iconProps = "h-5 w-5 text-indigo-300";
    switch (type) {
      case 'book':
        return <Book className={iconProps} />;
      case 'inbook':
        return <BookOpen className={iconProps} />;
      case 'article':
        return <FileText className={iconProps} />;
      case 'inproceedings':
      case 'proceedings':
        return <Scroll className={iconProps} />;
      case 'thesis':
        return <GraduationCap className={iconProps} />;
      case 'report':
        return <FileCode className={iconProps} />;
      case 'webpage':
        return <Globe className={iconProps} />;
      default:
        return <FileText className={iconProps} />;
    }
  };

  /*const getTypeInfo = (reference: Reference): { label: string; detail: string | null } => {
    //console.log(reference);
    //console.log(reference.type);
    const baseLabel = {
      article: "Journal Article",
      book: "Book",
      inbook: "Book Chapter",
      inproceedings: "Conference Paper",
      proceedings: "Conference Proceedings",
      thesis: "Thesis/Dissertation",
      report: "Technical Report",
      webpage: "Web Content"
    }[reference.type || 'article'] || "Unknown Type";
    let detail = null;
    switch (reference.type) {
      case 'article':
        detail = reference.journal || null;
        break;
      case 'book':
      case 'inbook':
        detail = reference.title || null;
        break;
      case 'inproceedings':
      case 'proceedings':
        detail = reference.conference || null;
        break;
      case 'thesis':
        detail = reference.publisher || null; // institution name
        break;
      case 'report':
        detail = reference.publisher || null; // organization name
        break;
      case 'webpage':
        detail = reference.url || null;
        break;
    }
    console.log(detail);
    return { label: baseLabel, detail };
  }*/

  const getTypeLabel = (type?: ReferenceType): string => ({
    article: "Journal Article",
    book: "Book",
    inbook: "Book Chapter",
    inproceedings: "Conference Paper",
    proceedings: "Conference Proceedings",
    thesis: "Thesis/Dissertation",
    report: "Technical Report",
    webpage: "Web Content"
  }[type || 'article'] || "Unknown Type")

  const getStatusText = (status: ReferenceStatus): string => ({
    verified: "Verified",
    error: "Needs Review",
    pending: "Pending",
    unverified: "Could not be verified"
  }[status] || status);

  const renderMessageWithLinks = (message: string) => {
    // Updated regex to better handle trailing punctuation
    // Captures the URL and any trailing punctuation separately
    const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^]+?)([.,)\]}>])?(?=\s|$)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(message)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(message.slice(lastIndex, match.index));
      }

      const [_, url, punctuation] = match;

      // Clean the URL by removing any trailing punctuation that might have been included
      const cleanUrl = url.replace(/[.,)\]}>]+$/, '');

      // Add the URL as a link
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

      // Add the punctuation after the link if it exists
      if (punctuation) {
        parts.push(punctuation);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last URL
    if (lastIndex < message.length) {
      parts.push(message.slice(lastIndex));
    }

    return parts;
  };

  /*const renderIdentifiers = () => {
    const identifiers = [];
    if (reference.DOI) identifiers.push(['DOI', reference.DOI]);
    if (reference.arxivId) identifiers.push(['arXiv', reference.arxivId]);
    if (reference.PMID) identifiers.push(['PMID', reference.PMID]);
    if (reference.ISBN) identifiers.push(['ISBN', reference.ISBN]);

    return identifiers.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {identifiers.map(([label, value]) => (
          <span key={label} className="px-2 py-1 bg-black/30 rounded-lg text-xs text-white">
            {label}: {value}
          </span>
        ))}
      </div>
    ) : null;
  };

  const renderPublicationDetails = () => {
    let details = [];

    switch (reference.type) {
      case 'article':
        if (reference.journal) details.push(['Journal', reference.journal]);
        if (reference.volume) details.push(['Volume', reference.volume]);
        if (reference.issue) details.push(['Issue', reference.issue]);
        break;
      case 'inproceedings':
      case 'proceedings':
        if (reference.conference) details.push(['Conference', reference.conference]);
        break;
      case 'book':
      case 'inbook':
        if (reference.publisher) details.push(['Publisher', reference.publisher]);
        break;
      case 'thesis':
        if (reference.publisher) details.push(['Institution', reference.publisher]);
        break;
      case 'webpage':
        if (reference.date_of_access) details.push(['Accessed', new Date(reference.date_of_access).toLocaleDateString()]);
        break;
    }

    if (reference.pages) details.push(['Pages', reference.pages]);

    return details.length > 0 ? (
      <div className="grid grid-cols-2 gap-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <h3 className="text-sm font-medium text-indigo-300">{label}</h3>
            <p className="text-white text-sm">{value}</p>
          </div>
        ))}
      </div>
    ) : null;
  };*/


  
  const getPrioritizedDetails = (reference: Reference) => {
    const details = [];
    
    // Title is always first
    if (reference.title) {
      details.push({
        label: 'Title',
        value: reference.title
      });
    }
    
    // Authors are always second
    if (Array.isArray(reference.authors) && reference.authors.length > 0) {
      const authorText = reference.authors.length > 2
        ? `${reference.authors[0]}, ${reference.authors[1]}... et al.`
        : reference.authors.join(', ');
      
      details.push({
        label: 'Authors',
        value: authorText
      });
    }
    
    // Third slot depends on reference type
    switch (reference.type) {
      case 'article':
        if (reference.journal) {
          details.push({
            label: 'Journal',
            value: reference.journal
          });
        }
        break;
      case 'inproceedings':
      case 'proceedings':
        if (reference.conference) {
          details.push({
            label: 'Conference',
            value: reference.conference
          });
        }
        break;
      case 'book':
      case 'inbook':
        if (reference.publisher) {
          details.push({
            label: 'Publisher',
            value: reference.publisher
          });
        }
        break;
      case 'thesis':
        if (reference.publisher) {
          details.push({
            label: 'Institution',
            value: reference.publisher
          });
        }
        break;
      default:
        if (reference.year) {
          details.push({
            label: 'Year',
            value: reference.year.toString()
          });
        }
    }
    
    // Only return the first 3 items
    return details.slice(0, 3);
  };

  return (
    <Card title="" variant="borderless">
      <div className={`w-full min-w-[280px] max-w-[400px] justify-self-center bg-gradient-to-br ${getStatusColor(reference.status)} rounded-[1.5rem] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] transform group`}>
        <CardContent title={''}>
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center gap-2 bg-black/20 rounded-xl p-3 group-hover:bg-black/30 transition-colors">
              {getStatusIcon(reference.status)}
              <span className="text-lg font-semibold text-white">
                {getStatusText(reference.status)}
              </span>
            </div>

            {/* Reference Type */}
            <div className="bg-black/20 rounded-xl p-3 group-hover:bg-black/30 transition-colors">
              <div className="flex items-center gap-2">
                {getTypeIcon(reference.type)}
                <span className="text-white font-medium">
                  {getTypeLabel(reference.type)}
                </span>
              </div>
            </div>

            {/* Top 3 Reference Details */}
            <div className="space-y-3 bg-black/20 rounded-xl p-4 group-hover:bg-black/30 transition-colors">
              {getPrioritizedDetails(reference).map(({ label, value }) => (
                <div key={label}>
                  <h3 className="text-sm font-medium text-indigo-300">{label}</h3>
                  <p className="text-white font-medium leading-tight">{value}</p>
                </div>
              ))}
            </div>

            {/* Verification Notes */}
            {reference.message && (
              <div className="bg-black/20 rounded-xl p-4 group-hover:bg-black/30 transition-colors">
                <h3 className="text-sm font-medium text-indigo-300 mb-1">Verification Notes</h3>
                <p className="text-white text-sm leading-relaxed group-hover:line-clamp-none line-clamp-4 whitespace-pre-wrap">
                  {renderMessageWithLinks(reference.message)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default ReferenceCard;