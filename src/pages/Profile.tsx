 import { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { TestModeBanner } from '@/components/TestModeBanner';
 import { BottomNav } from '@/components/BottomNav';
 import { FeedbackModal } from '@/components/FeedbackModal';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import { useToast } from '@/hooks/use-toast';
 import {
   Shield,
   Copy,
   Check,
   LogOut,
   MessageSquarePlus,
   Eye,
   EyeOff,
   Settings,
 } from 'lucide-react';
 
 const Profile = () => {
   const navigate = useNavigate();
   const { profile, user, signOut } = useAuth();
   const { toast } = useToast();
   
   const [copied, setCopied] = useState(false);
   const [hideBalances, setHideBalances] = useState(false);
   const [feedbackOpen, setFeedbackOpen] = useState(false);
 
   const handleSignOut = async () => {
     await signOut();
     navigate('/');
   };
 
   const maskEmail = (email: string | undefined): string => {
     if (!email) return '***@***.com';
     const [local, domain] = email.split('@');
     if (!domain) return '***@***.com';
     const maskedLocal = local.charAt(0) + '***';
     return `${maskedLocal}@${domain}`;
   };
 
   const copyUsername = async () => {
     if (!profile?.username) return;
     try {
       await navigator.clipboard.writeText(`@${profile.username}`);
       setCopied(true);
       toast({
         title: 'Copied!',
         description: 'LexoPay ID copied to clipboard',
       });
       setTimeout(() => setCopied(false), 2000);
     } catch {
       toast({
         title: 'Failed to copy',
         description: 'Please copy manually',
         variant: 'destructive',
       });
     }
   };
 
   const getInitials = (name: string | null | undefined): string => {
     if (!name) return 'U';
     return name
       .split(' ')
       .map((n) => n.charAt(0).toUpperCase())
       .slice(0, 2)
       .join('');
   };
 
   const getKYCBadge = (tier: number) => {
     const tiers = [
       { label: 'Unverified', variant: 'outline' as const },
       { label: 'Basic', variant: 'secondary' as const },
       { label: 'Verified', variant: 'default' as const },
       { label: 'Premium', variant: 'default' as const },
     ];
     return tiers[tier] || tiers[0];
   };
 
   const kycBadge = getKYCBadge(profile?.kyc_tier ?? 0);
 
   return (
     <div className="min-h-screen bg-background pb-20">
       <TestModeBanner />
 
       {/* Header */}
       <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
         <div className="container max-w-lg mx-auto px-4 py-3">
           <div className="flex items-center gap-3">
             <Settings className="w-5 h-5 text-muted-foreground" />
             <h1 className="font-semibold text-base">Profile</h1>
           </div>
         </div>
       </header>
 
       {/* Main Content */}
       <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
         {/* Profile Card */}
         <Card className="glass-card border-border/50">
           <CardContent className="pt-6 pb-4">
             <div className="flex flex-col items-center text-center">
               {/* Avatar */}
               <Avatar className="w-20 h-20 mb-3">
                 <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                   {getInitials(profile?.display_name)}
                 </AvatarFallback>
               </Avatar>
 
               {/* Name & Username */}
               <h2 className="text-lg font-semibold">
                 {profile?.display_name || 'LexoPay User'}
               </h2>
               <p className="text-sm text-primary font-mono">@{profile?.username}</p>
 
               {/* Masked Email */}
               <p className="text-xs text-muted-foreground mt-1">
                 {maskEmail(user?.email)}
               </p>
 
               {/* Badges */}
               <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                 {profile?.is_admin && (
                   <Badge variant="default" className="gap-1 bg-primary text-primary-foreground text-xs">
                     <Shield className="w-3 h-3" />
                     ADMIN
                   </Badge>
                 )}
                 <Badge variant={kycBadge.variant} className="gap-1 text-xs">
                   <Shield className="w-3 h-3" />
                   {kycBadge.label}
                 </Badge>
               </div>
             </div>
           </CardContent>
         </Card>
 
         {/* LexoPay ID */}
         <Card className="glass-card border-border/50">
           <CardContent className="py-4">
             <div className="flex items-center justify-between">
               <div className="min-w-0 flex-1">
                 <p className="text-xs text-muted-foreground">LexoPay ID</p>
                 <p className="font-mono text-primary truncate">@{profile?.username}</p>
               </div>
               <Button
                 variant="outline"
                 size="sm"
                 className="shrink-0 gap-2"
                 onClick={copyUsername}
               >
                 {copied ? (
                   <Check className="w-4 h-4 text-success" />
                 ) : (
                   <Copy className="w-4 h-4" />
                 )}
                 {copied ? 'Copied' : 'Copy'}
               </Button>
             </div>
           </CardContent>
         </Card>
 
         {/* Settings Section */}
         <Card className="glass-card border-border/50">
           <CardContent className="py-2 divide-y divide-border/50">
             {/* Hide Balances Toggle */}
             <div className="flex items-center justify-between py-3">
               <div className="flex items-center gap-3">
                 {hideBalances ? (
                   <EyeOff className="w-5 h-5 text-muted-foreground" />
                 ) : (
                   <Eye className="w-5 h-5 text-muted-foreground" />
                 )}
                 <div>
                   <p className="text-sm font-medium">Hide balances</p>
                   <p className="text-xs text-muted-foreground">
                     Mask wallet amounts on dashboard
                   </p>
                 </div>
               </div>
               <Switch
                 checked={hideBalances}
                 onCheckedChange={setHideBalances}
               />
             </div>
 
             {/* Feedback Button */}
             <button
               className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-md"
               onClick={() => setFeedbackOpen(true)}
             >
               <MessageSquarePlus className="w-5 h-5 text-muted-foreground" />
               <div>
                 <p className="text-sm font-medium">Send Feedback</p>
                 <p className="text-xs text-muted-foreground">
                   Report bugs or suggest ideas
                 </p>
               </div>
             </button>
 
             {/* Log Out Button */}
             <button
               className="flex items-center gap-3 py-3 w-full text-left hover:bg-destructive/10 transition-colors -mx-2 px-2 rounded-md text-destructive"
               onClick={handleSignOut}
             >
               <LogOut className="w-5 h-5" />
               <p className="text-sm font-medium">Log out</p>
             </button>
           </CardContent>
         </Card>
 
         {/* Admin Access */}
         {profile?.is_admin && (
           <Button
             variant="outline"
             className="w-full min-h-[48px] gap-2"
             onClick={() => navigate('/admin')}
           >
             <Shield className="w-4 h-4" />
             Admin Panel
           </Button>
         )}
       </main>
 
       <BottomNav />
       <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
     </div>
   );
 };
 
 export default Profile;