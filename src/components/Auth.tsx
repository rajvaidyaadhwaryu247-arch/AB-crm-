import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase';
import { KeyRound, Mail, User, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

type AuthMode = 'login' | 'signup' | 'forgot';

export const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during Google Sign-In.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error("Name is required for registration");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setInfo('A password reset link has been sent to your email.');
        setEmail('');
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "An unexpected error occurred.";
      if (err.code === 'auth/user-not-found') errMsg = "No account found with this email.";
      if (err.code === 'auth/wrong-password') errMsg = "Incorrect password. Please try again.";
      if (err.code === 'auth/email-already-in-use') errMsg = "This email is already registered.";
      if (err.code === 'auth/weak-password') errMsg = "Password should be at least 6 characters.";
      if (err.code === 'auth/invalid-email') errMsg = "Please provide a valid email address.";
      if (err.code === 'auth/operation-not-allowed') {
        errMsg = "Email/Password sign-in is not enabled in your Firebase console. Please enable it under Authentication > Sign-in method, or sign in instantly with Google below.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Visual Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-900/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="h-5 w-5 text-slate-950" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-white">
            AB Graphics <span className="text-emerald-500">CRM</span>
          </span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          {mode === 'login' && 'Sign in to your account'}
          {mode === 'signup' && 'Create your CRM account'}
          {mode === 'forgot' && 'Reset your password'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {mode === 'login' && (
            <>
              Or{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
                className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                start your free trial
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Sign in instead
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              Back to sign in
            </button>
          )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#141414] border border-emerald-900/10 py-8 px-4 shadow-xl rounded-2xl sm:px-10"
        >
          {error && (
            <div className="mb-4 bg-red-950/30 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {info && (
            <div className="mb-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-200">{info}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleAuth}>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-400">
                  Full Name
                </label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#0d0d0d] border border-emerald-900/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 sm:text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-600" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#0d0d0d] border border-emerald-900/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 sm:text-sm"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-400">
                  Password
                </label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-600" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#0d0d0d] border border-emerald-900/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-end text-sm">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/5 text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 focus:outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : (
                  <>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Instructions'}
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-emerald-900/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#141414] px-2 text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-[#0d0d0d] hover:bg-[#121212] border border-emerald-900/20 hover:border-emerald-500/20 text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01 1 12 1 7.24 1 3.2 3.73 1.24 7.73l3.84 2.98C6.01 7.22 8.79 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.62z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.08 14.71c-.24-.73-.38-1.5-.38-2.31s.14-1.58.38-2.31L1.24 7.11C.44 8.71 0 10.5 0 12s.44 3.29 1.24 4.89l3.84-2.18z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.21 0-5.99-2.18-6.96-5.11l-3.84 2.98C3.2 20.27 7.24 23 12 23z"
                  />
                </svg>
                Sign In with Google
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className="mt-6 border-t border-emerald-900/10 pt-6 text-center text-xs text-gray-500">
              AB Graphics CRM is tailored specifically for digital marketing agencies. Securely manage your client portfolios, track prospects, and boost team collaboration.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
