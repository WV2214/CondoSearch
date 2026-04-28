import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <form className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Condo Search</h1>
        {error && (
          <div className="text-sm text-red-300 border border-red-900 bg-red-950/40 rounded px-3 py-2">
            {error}
          </div>
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-2">
          <button
            formAction={signIn}
            className="flex-1 bg-zinc-100 text-zinc-900 rounded py-2 font-medium hover:bg-white"
          >
            Sign in
          </button>
          <button
            formAction={signUp}
            className="flex-1 border border-zinc-700 rounded py-2 hover:bg-zinc-900"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
