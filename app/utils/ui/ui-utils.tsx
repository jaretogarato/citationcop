import React from "react";

export const renderMessageWithLinks = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^]+?)([.,)\]}>])?(?=\s|$)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let linkCounter = 0;

    while ((match = urlRegex.exec(message)) !== null) {
        if (match.index > lastIndex) {
            parts.push(message.slice(lastIndex, match.index));
        }

        const [fullMatch, url, punctuation = ''] = match;
        const cleanUrl = url.replace(/[.,)\]}>]+$/, '');

        if (isValidUrl(cleanUrl)) {
            linkCounter++;
            parts.push(
                <a
                    key={`link-${linkCounter}`}
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                    title={cleanUrl}
                >
                    here
                </a>
            );
            if (punctuation) parts.push(punctuation);
        } else {
            parts.push(cleanUrl + punctuation);
        }

        lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < message.length) {
        parts.push(message.slice(lastIndex));
    }

    return (
        <React.Fragment>
            {parts.map((part, index) =>
                typeof part === 'string' ? (
                    <span key={`text-${index}`}>{part}</span>
                ) : part
            )}
        </React.Fragment>
    );
};

const isValidUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
};