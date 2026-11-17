export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-400">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-6 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
      >
        Back to Stackly
      </a>
    </div>
  );
}

