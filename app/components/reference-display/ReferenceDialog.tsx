import React from 'react'
import {
  Reference,
  ReferenceStatus
  //SearchResultItem
} from '@/app/types/reference'
import {
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/tabs'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { renderMessageWithLinks } from '@/app/utils/ui/ui-utils'

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Link as LinkIcon,
  Book,
  Calendar,
  Building,
  //Search,
  ExternalLink
} from 'lucide-react'

const tabColors = {
  details: {
    gradient: 'from-indigo-900/50 to-indigo-800/50',
    text: 'text-indigo-300',
    activeText: 'text-indigo-200',
    accent: 'bg-indigo-400/10',
    border: 'border-indigo-400',
    activeBg: 'bg-indigo-400/10',
    hoverBg: 'hover:bg-indigo-400/5',
    ring: 'ring-indigo-400',
    focusColor: 'focus-visible:ring-indigo-400'
  },
  verification: {
    gradient: 'from-emerald-900/50 to-emerald-800/50',
    text: 'text-emerald-300',
    activeText: 'text-emerald-200',
    accent: 'bg-emerald-400/10',
    border: 'border-emerald-400',
    activeBg: 'bg-emerald-400/10',
    hoverBg: 'hover:bg-emerald-400/5',
    ring: 'ring-emerald-400',
    focusColor: 'focus-visible:ring-emerald-400'
  },
  'Full Reference': {
    gradient: 'from-rose-900/50 to-rose-800/50',
    text: 'text-rose-300',
    activeText: 'text-rose-200',
    accent: 'bg-rose-400/10',
    border: 'border-rose-400',
    activeBg: 'bg-rose-400/10',
    hoverBg: 'hover:bg-rose-400/5',
    ring: 'ring-rose-400',
    focusColor: 'focus-visible:ring-rose-400'
  }
}

export interface ReferenceDialogProps {
  reference: Reference
}
const statusConfig = {
  verified: {
    text: 'text-emerald-300',
    icon: <CheckCircle className="h-6 w-6 text-emerald-400" />,
    displayText: 'Verified'
  },
  'needs-human': {
    text: 'text-amber-300',
    icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
    displayText: 'Needs human verification'
  },
  error: {
    text: 'text-slate-300',
    icon: <AlertTriangle className="h-6 w-6 text-slate-400" />,
    displayText: 'Oops, something went wrong'
  },
  unverified: {
    text: 'text-rose-300',
    icon: <XCircle className="h-6 w-6 text-rose-400" />,
    displayText: 'Could not be verified'
  },
  pending: {
    text: 'text-indigo-300',
    icon: <AlertTriangle className="h-6 w-6 text-indigo-400" />,
    displayText: 'Pending'
  }
}
export const ReferenceDialog = ({ reference }: ReferenceDialogProps) => {
  const [activeTab, setActiveTab] = React.useState('details')

  const getStatusTextColor = (status: ReferenceStatus): string =>
    statusConfig[status]?.text || 'text-gray-300'

  const getStatusIcon = (status: ReferenceStatus): JSX.Element | null =>
    statusConfig[status]?.icon || null

  const getStatusText = (status: ReferenceStatus): string =>
    statusConfig[status]?.displayText || status

  const formatAuthors = (authors: string[] = []) => {
    if (authors.length === 0) return ''
    if (authors.length <= 2) return authors.join(', ')
    return `${authors[0]}, ${authors[1]} et al.`
  }

  const renderField = (
    label: string,
    value: string | null | undefined,
    icon: JSX.Element
  ) => {
    if (!value) return null
    const colors = tabColors[activeTab as keyof typeof tabColors]

    const isExplicitUrl = label === 'URL' || label === 'DOI'

    const getHostname = (url: string) => {
      try {
        return new URL(url).hostname
      } catch {
        return url
      }
    }

    return (
      <div className={`flex items-start gap-2 p-3 ${colors.accent} rounded-lg`}>
        {React.cloneElement(icon, {
          className: `h-5 w-5 ${colors.text} mt-0.5 flex-shrink-0`
        })}
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-medium ${colors.text}`}>{label}</h4>
          {isExplicitUrl ? (
            value.startsWith('http') ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:opacity-80 flex items-center gap-2"
              >
                <span className="break-words">{getHostname(value)}</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-white whitespace-pre-wrap break-words">
                {value}
              </p>
            )
          ) : (
            <p className="text-white whitespace-pre-wrap break-words">
              {renderMessageWithLinks(value)}
            </p>
          )}
        </div>
      </div>
    )
  }

  /*const renderSearchResults = (results: SearchResultItem[]) => {
    return results.map((result, index) => (
      <div key={index} className="p-3 bg-black/10 rounded-lg space-y-2">
        <a
          href={result.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${tabColors.search.text} hover:opacity-80 font-medium flex items-center gap-2`}
        >
          <span className="break-words">{result.title}</span>
          <ExternalLink className="h-4 w-4 flex-shrink-0" />
        </a>
        <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
          {result.snippet}
        </p>
      </div>
    ))
  }*/

  return (
    <DialogContent className="max-w-2xl bg-gray-900">
      <DialogHeader>
        <DialogTitle className="text-white">Reference Details</DialogTitle>
      </DialogHeader>

      <Tabs
        defaultValue="details"
        className="w-full"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-3 p-1 bg-black/20">
          {Object.entries(tabColors).map(([tab, colors]) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className={`
                                ${colors.text}
                                ${colors.hoverBg}
                                transition-colors
                                duration-200
                                data-[state=active]:${colors.activeText}
                                data-[state=active]:${colors.activeBg}
                                data-[state=active]:ring-2
                                data-[state=active]:${colors.ring}
                                focus-visible:ring-2
                                ${colors.focusColor}
                                focus-visible:ring-offset-0
                                ring-offset-0
                                outline-none
                            `}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea
          className={`
                    h-[60vh] 
                    mt-4 
                    rounded-md 
                    border 
                    ${tabColors[activeTab as keyof typeof tabColors].border}
                    p-4
                    ${tabColors[activeTab as keyof typeof tabColors].gradient}
                `}
        >
          <TabsContent value="details" className="space-y-4 pr-4">
            {renderField('Title', reference.title, <Book />)}
            {renderField('Authors', formatAuthors(reference.authors), <Info />)}
            {renderField('Journal', reference.journal, <Book />)}
            {renderField('Year', reference.year, <Calendar />)}
            {renderField('Publisher', reference.publisher, <Building />)}
            {renderField('DOI', reference.DOI, <LinkIcon />)}
            {renderField('arXiv ID', reference.arxivId, <LinkIcon />)}
            {renderField('PMID', reference.PMID, <LinkIcon />)}
            {renderField('ISBN', reference.ISBN, <LinkIcon />)}
            {renderField('URL', reference.url, <LinkIcon />)}
            {renderField('Volume', reference.volume, <Book />)}
            {renderField('Issue', reference.issue, <Book />)}
            {renderField('Pages', reference.pages, <Book />)}
            {renderField('Conference', reference.conference, <Building />)}
            {renderField('Type', reference.type, <Info />)}
            {renderField('Raw', reference.raw, <Info />)}
          </TabsContent>

          <TabsContent value="verification" className="space-y-4 pr-4">
            <div className="flex items-center gap-2 p-3 bg-black/10 rounded-lg">
              {getStatusIcon(reference.status)}
              <div className="min-w-0 flex-1">
                <h4
                  className={`text-sm font-medium ${getStatusTextColor(reference.status)}`}
                >
                  Status
                </h4>
                <p className="text-white whitespace-pre-wrap break-words">
                  {getStatusText(reference.status)}
                </p>
              </div>
            </div>
            {renderField(
              'Verification Source',
              reference.verification_source,
              <Info />
            )}
            {renderField('Verification Notes', reference.message, <Info />)}
          </TabsContent>

          <TabsContent value="Full Reference" className="space-y-4 pr-4">
            {reference.fixedReference ? (
              <div className="p-6 bg-black/10 rounded-lg">
                <p className="text-white whitespace-pre-wrap break-words text-lg leading-relaxed">
                  {reference.fixedReference}
                </p>
              </div>
            ) : (
              <div className="text-center text-gray-300 py-8">
                <Book className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No formatted reference available</p>
              </div>
            )}
          </TabsContent>
          {/*<TabsContent value="search" className="space-y-4 pr-4">
            {reference.searchResults?.organic ? (
              <div className="space-y-4">
                {renderSearchResults(reference.searchResults.organic)}
              </div>
            ) : (
              <div className="text-center text-gray-300 py-8">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No search results available</p>
              </div>
            )}
          </TabsContent>*/}
        </ScrollArea>
      </Tabs>
    </DialogContent>
  )
}
