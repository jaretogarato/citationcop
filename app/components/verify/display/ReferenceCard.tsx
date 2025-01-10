import React from 'react'
import { Reference, ReferenceStatus } from '@/app/types/reference'
import { Dialog, DialogTrigger } from "@/app/components/ui/dialog"
import { ReferenceDialog } from "@/app/components/verify/display/ReferenceDialog"
import { renderMessageWithLinks } from '@/app/utils/ui/ui-utils'

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Link as LinkIcon,

} from "lucide-react";

export interface ReferenceCardProps {
  reference: Reference;
}

export const ReferenceCard = ({ reference }: ReferenceCardProps) => {
  const getStatusColor = (status: ReferenceStatus): string => ({
    verified: "from-emerald-900/50 to-emerald-800/50",
    unverified: "from-rose-900/50 to-rose-800/50",
    error: "from-amber-900/50 to-amber-800/50",
    pending: "from-indigo-900/50 to-indigo-800/50"
  }[status] || "from-gray-900/50 to-gray-800/50");

  const getStatusTextColor = (status: ReferenceStatus): string => ({
    verified: "text-emerald-300",
    unverified: "text-rose-300",
    error: "text-amber-300",
    pending: "text-indigo-300"
  }[status] || "text-gray-300");

  const getStatusAccentColor = (status: ReferenceStatus): string => ({
    verified: "bg-emerald-400/10",
    unverified: "bg-rose-400/10",
    error: "bg-amber-400/10",
    pending: "bg-indigo-400/10"
  }[status] || "bg-gray-400/10");

  const getStatusIcon = (status: ReferenceStatus): JSX.Element | null => ({
    verified: <CheckCircle className="h-6 w-6 text-emerald-400" />,
    error: <AlertTriangle className="h-6 w-6 text-amber-400" />,
    pending: <AlertTriangle className="h-6 w-6 text-indigo-400" />,
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

  

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={`w-full min-w-[280px] max-w-[400px] justify-self-center bg-gradient-to-br ${getStatusColor(reference.status)} rounded-[1.5rem] overflow-hidden shadow-xl cursor-pointer hover:opacity-90 transition-opacity`}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/20 rounded-xl p-3 flex-1">
                {getStatusIcon(reference.status)}
                <span className="text-lg font-semibold text-white">
                  {getStatusText(reference.status)}
                </span>
              </div>
              <div className={`p-2 rounded-xl cursor-pointer ${getStatusAccentColor(reference.status)} hover:opacity-80 transition-opacity ml-2`}>
                <Info className={`h-5 w-5 ${getStatusTextColor(reference.status)}`} />
              </div>
            </div>

            <div className={`space-y-3 ${getStatusAccentColor(reference.status)} rounded-xl p-4`}>
              <div>
                <h3 className={`text-sm font-medium ${getStatusTextColor(reference.status)}`}>Title</h3>
                <p className="text-white font-medium leading-tight">{reference.title}</p>
              </div>
              <div>
                <h3 className={`text-sm font-medium ${getStatusTextColor(reference.status)}`}>Authors</h3>
                <p className="text-white font-medium leading-tight">{formatAuthors(reference.authors)}</p>
              </div>
            </div>

            {reference.message && (
              <div className={`${getStatusAccentColor(reference.status)} rounded-xl p-4`}>
                <h3 className={`text-sm font-medium ${getStatusTextColor(reference.status)} mb-1`}>Verification Notes</h3>
                <div className="max-h-24 overflow-y-auto">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {renderMessageWithLinks(reference.message)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogTrigger>

      <ReferenceDialog reference={reference} />
    </Dialog>
  );
}

export default ReferenceCard;