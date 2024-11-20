/*import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@/lib/supabase';
import Cookies from 'js-cookie';


interface UseReferenceLimitReturn {
  isAuthenticated: boolean;
  canProcessReferences: boolean;
  remainingReferences: number;
  limitReferences: (references: any[]) => any[];
  updateReferenceCount: () => void;
}

export const useReferenceLimit = (): UseReferenceLimitReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClientComponentClient();
  const REFERENCE_LIMIT = 5;
  const COOKIE_NAME = 'reference_count';
  const COOKIE_EXPIRE_DAYS = 7;

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(( _event: any, session: Session | null) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get current reference count from cookie
  const getReferenceCount = (): number => {
    return parseInt(Cookies.get(COOKIE_NAME) || '0');
  };

  // Calculate remaining references
  const getRemainingReferences = (): number => {
    if (isAuthenticated) return Infinity;
    return Math.max(0, REFERENCE_LIMIT - getReferenceCount());
  };

  // Check if user can process more references
  const canProcessReferences = (): boolean => {
    if (isAuthenticated) return true;
    return getReferenceCount() < REFERENCE_LIMIT;
  };

  // Limit references array to maximum allowed
  const limitReferences = (references: any[]): any[] => {
    if (isAuthenticated) return references;
    const remaining = getRemainingReferences();
    return references.slice(0, remaining);
  };

  // Update reference count in cookie
  const updateReferenceCount = (): void => {
    if (!isAuthenticated) {
      const currentCount = getReferenceCount();
      Cookies.set(COOKIE_NAME, String(currentCount + 1), { expires: COOKIE_EXPIRE_DAYS });
    }
  };

  return {
    isAuthenticated,
    canProcessReferences: canProcessReferences(),
    remainingReferences: getRemainingReferences(),
    limitReferences,
    updateReferenceCount,
  };
};*/