import { 
    createContext, 
    useContext, 
    useEffect, 
    useState,
    ReactNode
  } from 'react';
  import { User } from '@supabase/supabase-js';
  import { createClient } from '@/utils/supabase/server';
  import { getUser, getUserDetails, getSubscription } from '@/utils/supabase/queries';
  
  // Define types for your data
  interface UserDetails {
    id: string;
    // ... add other user detail fields
  }
  
  interface Subscription {
    id: string;
    status: string;
    // ... add other subscription fields
  }
  
  // Define the shape of your context
  interface AuthContextData {
    user: User | null;
    userDetails: UserDetails | null;
    subscription: Subscription | null;
    isLoading: boolean;
    refreshAuth: () => Promise<void>;
  }
  
  // Create the context
  const AuthContext = createContext<AuthContextData | undefined>(undefined);
  
  // Provider component
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
  
    const supabase = createClient();
  
    const loadAuthData = async () => {
      try {
        setIsLoading(true);
        const currentUser = await getUser(supabase);
        
        if (currentUser) {
          // Load user details and subscription in parallel
          const [details, subs] = await Promise.all([
            getUserDetails(supabase),
            getSubscription(supabase)
          ]);
          
          setUser(currentUser);
          setUserDetails(details);
          setSubscription(subs);
        } else {
          // Reset states if no user
          setUser(null);
          setUserDetails(null);
          setSubscription(null);
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
        // Reset states on error
        setUser(null);
        setUserDetails(null);
        setSubscription(null);
      } finally {
        setIsLoading(false);
      }
    };
  
    useEffect(() => {
      // Load initial auth state
      loadAuthData();
  
      // Subscribe to auth changes
      const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            setUser(session.user);
            await loadAuthData();
          } else {
            setUser(null);
            setUserDetails(null);
            setSubscription(null);
          }
        }
      );
  
      // Cleanup subscription
      return () => {
        authListener.unsubscribe();
      };
    }, []);
  
    const value = {
      user,
      userDetails,
      subscription,
      isLoading,
      refreshAuth: loadAuthData
    };
  
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }
  
  // Custom hook to use the auth context
  export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  }