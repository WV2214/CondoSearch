import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Condo Search</h1>
        {error && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {error}
          </div>
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="w-full border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button
            formAction={signIn}
            className="flex-1 bg-black text-white rounded py-2"
          >
            Sign in
          </button>
          <button
            formAction={signUp}
            className="flex-1 border rounded py-2"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
