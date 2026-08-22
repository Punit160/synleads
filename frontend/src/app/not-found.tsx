import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-4xl font-bold text-indigo-600 mb-2">404</p>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/" className="auth-btn-primary text-sm px-5 py-2.5 inline-flex justify-center">
            Go home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
