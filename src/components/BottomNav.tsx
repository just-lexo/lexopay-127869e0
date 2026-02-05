 import { useLocation, useNavigate } from 'react-router-dom';
 import { Home, Send, History, User } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 const navItems = [
   { path: '/dashboard', label: 'Home', icon: Home },
   { path: '/send', label: 'Send', icon: Send },
   { path: '/transactions', label: 'History', icon: History },
   { path: '/profile', label: 'Profile', icon: User },
 ];
 
 export function BottomNav() {
   const location = useLocation();
   const navigate = useNavigate();
 
   const isActive = (path: string) => {
     if (path === '/dashboard') {
       return location.pathname === '/dashboard' || location.pathname === '/';
     }
     return location.pathname.startsWith(path);
   };
 
   return (
     <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50 safe-area-bottom">
       <div className="container max-w-lg mx-auto px-2">
         <div className="flex items-center justify-around">
           {navItems.map((item) => {
             const active = isActive(item.path);
             return (
               <button
                 key={item.path}
                 onClick={() => navigate(item.path)}
                 className={cn(
                   'flex flex-col items-center justify-center py-2 px-3 min-w-[64px] min-h-[56px] transition-colors',
                   active
                     ? 'text-primary'
                     : 'text-muted-foreground hover:text-foreground'
                 )}
               >
                 <item.icon
                   className={cn(
                     'w-5 h-5 mb-1 transition-transform',
                     active && 'scale-110'
                   )}
                 />
                 <span
                   className={cn(
                     'text-[10px] font-medium',
                     active && 'font-semibold'
                   )}
                 >
                   {item.label}
                 </span>
               </button>
             );
           })}
         </div>
       </div>
     </nav>
   );
 }