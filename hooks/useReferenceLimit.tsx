import Cookies from 'universal-cookie';

interface UseReferenceLimitReturn {
  canProcessReferences: boolean;
  remainingReferences: number;
  limitReferences: <T extends any[]>(references: T) => T;
  updateReferenceCount: (count: number) => void;
}

export const useReferenceLimit = (isAuthenticated: boolean): UseReferenceLimitReturn => {
  const DISABLE_LIMITS = process.env.NEXT_PUBLIC_DISABLE_REFERENCE_LIMITS === 'true';
  const cookies = new Cookies();
  
  const REFERENCE_LIMIT = 5;
  const COOKIE_NAME = 'reference_count';
  const COOKIE_OPTIONS = {
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production'
  };

  const getReferenceCount = (): number => {
    if (DISABLE_LIMITS) return 0;
    
    try {
      const count = cookies.get(COOKIE_NAME);
      return typeof count === 'number' ? count : 0;
    } catch (error) {
      console.error('Error reading cookie:', error);
      return 0;
    }
  };

  const updateReferenceCount = (newReferences: number): void => {
    if (DISABLE_LIMITS || isAuthenticated) return;
    
    try {
      const currentCount = getReferenceCount();
      cookies.set(COOKIE_NAME, currentCount + newReferences, COOKIE_OPTIONS);
    } catch (error) {
      console.error('Error updating cookie:', error);
    }
  };

  const getRemainingReferences = (): number => {
    if (DISABLE_LIMITS || isAuthenticated) return Infinity;
    return Math.max(0, REFERENCE_LIMIT - getReferenceCount());
  };

  const canProcessReferences = (): boolean => {
    if (DISABLE_LIMITS || isAuthenticated) return true;
    return getReferenceCount() < REFERENCE_LIMIT;
  };

  const limitReferences = <T extends any[]>(references: T): T => {
    if (DISABLE_LIMITS || isAuthenticated) return references;
    const remaining = getRemainingReferences();
    return references.slice(0, remaining) as T;
  }

  return {
    canProcessReferences: canProcessReferences(),
    remainingReferences: getRemainingReferences(),
    limitReferences,
    updateReferenceCount
  };
};